/* =====================================================================
 *  ari-app.js — Asterisk ARI call control.
 *
 *  Three call flows, all of them writing the same lead lifecycle and the
 *  same call-history rows:
 *
 *   OUTBOUND (manual)   browser --WSS--> Asterisk --Stasis--> bridge --> GSM
 *   INBOUND             GSM trunk --Stasis--> bridge --> first READY agent
 *   PREDICTIVE          engine originates the GSM leg with NO agent attached;
 *                       when the customer answers the engine names an agent,
 *                       that leg is originated and both are bridged.
 *
 *  Gateway selection is always DYNAMIC — resolved from the campaign the agent
 *  is working, never hardcoded and never from .env.
 *
 *  Every channel event is reported back to the engine so the lead's status
 *  moves DIALING -> RINGING -> CONNECTED -> terminal without gaps, and the
 *  Asterisk hangup cause is preserved on the call-history row.
 * ===================================================================== */

"use strict";

const ari = require("ari-client");
const mysql = require("mysql2/promise");

const { LEAD_STATUS, outcomeToStatus } = require("./src/lib/leadStatus.js");
const { createDialerLog, EVENT } = require("./src/lib/dialerLog.js");
const W = require("./src/lib/leadWriter.js");

module.exports = function startAri(config) {
  const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    timezone: "+05:30",
  });

  const log = createDialerLog(db, { tag: "ARI" });
  console.log(
    `[ari] DB pool: ${process.env.DB_USER}@${process.env.DB_HOST}/${process.env.DB_NAME}`,
  );

  const {
    ariUrl,
    ariUser,
    ariPass,
    ariApp,
    browserEndpoint,
    outboundPrefix,
    callerId,
  } = config;

  const fetch = globalThis.fetch || require("node-fetch");
  const authHeader = {
    Authorization: "Basic " + Buffer.from(`${ariUser}:${ariPass}`).toString("base64"),
  };

  /** Engine callbacks — replaced by setHandlers() once the engine is up. */
  let handlers = {
    onRinging: async () => {},
    onAnswered: async () => null,
    onBridged: async () => {},
    onEnded: async () => {},
  };

  /** attemptId (== channelId) -> predictive attempt bookkeeping. */
  const predictive = new Map();
  /** ARI REST client; null while disconnected so the engine pauses cleanly. */
  let client = null;

  /* ==================================================================
   *  Gateway resolution (manual/outbound path)
   * ================================================================== */

  /** Read the X-Gateway SIP header the browser sets for the selected campaign. */
  async function readGatewayHeader(channel) {
    try {
      const v = await channel.getChannelVar({
        variable: "PJSIP_HEADER(read,X-Gateway)",
      });
      const val = v && v.value ? String(v.value).trim() : "";
      return val || null;
    } catch {
      return null; // header absent -> fall through to DB resolution
    }
  }

  /** Validate an endpoint name (e.g. "gw3") against gsm_gateways. */
  async function validateGatewayEndpoint(endpointName) {
    if (!endpointName) return null;
    const [rows] = await db.query(
      `SELECT id, name, asterisk_endpoint AS endpoint, status, reachable
         FROM gsm_gateways
        WHERE asterisk_endpoint = ?
        LIMIT 1`,
      [endpointName],
    );
    const g = rows[0];
    if (!g || g.status !== "active" || !g.endpoint) return null;
    if (Number(g.reachable) === 0) return null; // health check says it is down
    return { gatewayId: g.id, gatewayName: g.name, endpoint: g.endpoint };
  }

  /**
   * The agent's best gateway from the campaigns they can work — group-based
   * (primary) plus legacy per-agent assignments. Least-loaded-first ordering
   * is handled by the engine's pool for predictive calls; a manual call simply
   * takes the highest-priority reachable gateway.
   */
  async function getActiveGatewayForExtension(extension) {
    if (!extension) return null;
    const [rows] = await db.query(
      `SELECT g.id, g.name, g.asterisk_endpoint AS endpoint, c.id AS campaignId
         FROM employees e
         JOIN campaigns c
           ON c.status = 'active'
          AND ( c.id IN (SELECT campaign_id FROM campaign_assignments WHERE employee_id = e.user_id)
                OR c.group_id IN (SELECT group_id FROM group_agents WHERE agent_id = e.user_id) )
         JOIN campaign_gateways cg ON cg.campaign_id = c.id
         JOIN gsm_gateways g
           ON g.id = cg.gateway_id
          AND g.status = 'active'
          AND g.reachable = 1
          AND g.asterisk_endpoint IS NOT NULL
          AND g.asterisk_endpoint <> ''
        WHERE e.sip_extension = ?
        ORDER BY g.priority DESC, c.id DESC
        LIMIT 1`,
      [extension],
    );
    const g = rows[0];
    if (!g) return null;
    return {
      gatewayId: g.id,
      gatewayName: g.name,
      endpoint: g.endpoint,
      campaignId: g.campaignId,
    };
  }

  /**
   * Full resolution chain for one manual outbound call.
   * @returns {{gatewayId,gatewayName,endpoint,campaignId,via}|{reason:string}}
   */
  async function resolveOutboundGateway(browserChannel, callerExt) {
    const headerEp = await readGatewayHeader(browserChannel);
    if (headerEp) {
      const v = await validateGatewayEndpoint(headerEp).catch(() => null);
      if (v) return { ...v, campaignId: null, via: "x-gateway-header" };
      console.warn(
        `[ari][outbound] X-Gateway "${headerEp}" is not an active/reachable gateway — ignoring`,
      );
    }
    if (callerExt) {
      const v = await getActiveGatewayForExtension(callerExt).catch((e) => {
        console.error("[ari][outbound] gateway lookup failed: " + (e && e.message));
        return null;
      });
      if (v) return { ...v, via: "db-campaign" };
      return { reason: `no active gateway for extension ${callerExt}` };
    }
    return { reason: "could not parse caller extension from channel name" };
  }

  /* ==================================================================
   *  Shared helpers
   * ================================================================== */

  async function isRecordingEnabledForCampaign(campaignId) {
    if (!campaignId) return false;
    const [rows] = await db.query(
      "SELECT recording_enabled FROM campaigns WHERE id = ?",
      [campaignId],
    );
    return rows[0] ? Number(rows[0].recording_enabled) === 1 : false;
  }

  async function isRecordingEnabledForExtension(extension) {
    const [rows] = await db.query(
      `SELECT MAX(c.recording_enabled) AS on_
         FROM employees e
         JOIN campaigns c
           ON c.id IN (SELECT campaign_id FROM campaign_assignments WHERE employee_id = e.user_id)
           OR c.group_id IN (SELECT group_id FROM group_agents WHERE agent_id = e.user_id)
        WHERE e.sip_extension = ?`,
      [extension],
    );
    return rows[0] ? Number(rows[0].on_) === 1 : false;
  }

  /** Start bridge recording and register the file for the wrap-up to pick up. */
  async function startRecording(bridge, extension, phoneNumber) {
    const fname = `rec-${extension || "srv"}-${phoneNumber}-${Date.now()}`;
    try {
      await bridge.record({ name: fname, format: "wav", ifExists: "overwrite" });
      await db
        .query(
          `INSERT INTO pending_recordings (extension, phone_number, filename)
           VALUES (?,?,?)`,
          [String(extension || ""), String(phoneNumber), fname + ".wav"],
        )
        .catch((e) => console.error("[ari] pending_recording insert: " + (e && e.message)));
      return fname + ".wav";
    } catch (e) {
      console.error("[ari] recording start failed: " + (e && e.message));
      return null;
    }
  }

  /**
   * Answering-machine detection.
   *
   * Asterisk's AMD() runs in the dialplan, so this reads the AMDSTATUS channel
   * variable the dialplan leaves behind (see asterisk-config/extensions.conf).
   * If the dialplan does not run AMD the variable is simply absent and every
   * answered call is treated as a human — detection degrades to off rather
   * than guessing.
   */
  async function amdStatus(channel) {
    try {
      const v = await channel.getChannelVar({ variable: "AMDSTATUS" });
      const val = v && v.value ? String(v.value).trim().toUpperCase() : "";
      return val || null;
    } catch {
      return null;
    }
  }

  const hangupInfo = (event) => ({
    causeCode: event && event.cause != null ? Number(event.cause) : null,
    causeText: (event && event.cause_txt) || null,
  });

  /* ==================================================================
   *  Connection
   * ================================================================== */

  function connect() {
    ari
      .connect(ariUrl, ariUser, ariPass)
      .then((c) => {
        client = c;
        client.on("StasisStart", (event, channel) => {
          const role = (event.args && event.args[0]) || "";
          if (role === "outbound") {
            handleOutbound(client, channel).catch((e) =>
              console.error("[ari][outbound] " + (e && e.message)),
            );
          } else if (role === "inbound") {
            handleInbound(client, channel).catch((e) =>
              console.error("[ari][inbound] " + (e && e.message)),
            );
          } else if (role === "predictive") {
            handlePredictive(client, channel).catch((e) =>
              console.error("[ari][predictive] " + (e && e.message)),
            );
          }
          // role === "pred-agent" / "dialed" / "tobrowser" are handled by the
          // per-channel listeners the flows above install.
        });

        // Ring detection for predictive attempts is done at the CLIENT level,
        // not with a per-channel listener. An originated channel has not
        // entered Stasis yet while it is ringing, and node-ari-client only
        // routes events to a Channel instance once the resource is in the app —
        // so a per-channel handler silently never fires and every attempt
        // skipped RINGING. The app receives the event either way; we just have
        // to match it up by channel id ourselves.
        client.on("ChannelStateChange", (_event, channel) => {
          const info = channel && predictive.get(channel.id);
          if (!info || info.answered || info.finished) return;
          const st = String(channel.state || "");
          if (st === "Ringing" || st === "Ring") {
            handlers.onRinging(info.attemptId).catch(() => {});
          }
        });

        client.on("WebSocketError", (err) =>
          console.error("[ari] websocket error: " + (err && err.message)),
        );

        client.start(ariApp);
        console.log(`[ari] connected to ${ariUrl} app="${ariApp}"`);
      })
      .catch((err) => {
        console.error("[ari] connection failed: " + (err && err.message));
        console.error("[ari] retrying in 5s...");
        client = null; // engine pauses cleanly until the retry succeeds
        setTimeout(connect, 5000);
      });
  }

  /* ==================================================================
   *  OUTBOUND — manual dial from the browser
   * ================================================================== */

  /**
   * Find the lead this manual call belongs to: /api/employee/dialer/next has
   * already claimed it for this agent, so it is the freshest claim on that
   * number. Without this, a manual attempt would produce no history row.
   */
  async function findClaimedLead(extension, dialed) {
    if (!extension || !dialed) return null;
    const [rows] = await db.query(
      `SELECT d.id, d.campaign_id, d.list_id, d.name, d.call_count, d.call_status,
              u.id AS agent_id
         FROM csv_data d
         JOIN employees e ON e.sip_extension = ?
         JOIN users u     ON u.id = e.user_id
        WHERE d.assigned_to = u.id
          AND REPLACE(REPLACE(REPLACE(d.phone_number,' ',''),'-',''),'+','')
              LIKE CONCAT('%', ?)
          AND d.claimed_at IS NOT NULL
        ORDER BY d.claimed_at DESC
        LIMIT 1`,
      [String(extension), String(dialed).replace(/[^\d]/g, "").slice(-10)],
    );
    return rows[0] || null;
  }

  async function handleOutbound(client, browserChannel) {
    const dialed = (browserChannel.dialplan && browserChannel.dialplan.exten) || "";
    const target = (outboundPrefix || "") + dialed;

    const extMatch = (browserChannel.name || "").match(/PJSIP\/(\d+)-/);
    const callerExt = extMatch ? extMatch[1] : null;

    const resolved = await resolveOutboundGateway(browserChannel, callerExt);
    if (!resolved || !resolved.endpoint) {
      const reason = (resolved && resolved.reason) || "no active gateway assigned to the campaign";
      console.error(
        `[ari][outbound] CALL BLOCKED — not dialing. ext=${callerExt || "?"} ` +
          `dialed=${dialed} reason="${reason}"`,
      );
      try {
        await browserChannel.hangup();
      } catch {
        /* gone */
      }
      return;
    }

    const selectedTrunk = resolved.endpoint;
    console.log(
      `[ari][outbound] ext=${callerExt} campaign=${resolved.campaignId ?? "?"} ` +
        `gateway#${resolved.gatewayId} "${resolved.gatewayName}" ` +
        `endpoint=PJSIP/${selectedTrunk} dialed=${dialed} via=${resolved.via}`,
    );

    // The lead + history row for this manual attempt.
    const lead = await findClaimedLead(callerExt, dialed).catch(() => null);
    let callId = null;
    let attemptNo = 0;
    if (lead) {
      const dial = await W.markDialing(db, {
        leadId: lead.id,
        gatewayId: resolved.gatewayId,
        viaRecycle: false,
        agentId: lead.agent_id,
      }).catch(() => null);
      attemptNo = dial ? dial.attemptNo : 0;
      callId = await W.startCallRecord(db, {
        employeeId: lead.agent_id,
        campaignId: lead.campaign_id,
        leadId: lead.id,
        listId: lead.list_id,
        gatewayId: resolved.gatewayId,
        phoneNumber: dialed,
        contactName: lead.name,
        dialSource: "manual",
        attemptNo,
        channelId: browserChannel.id,
      });
      log.log(EVENT.DIAL_STARTED, {
        leadId: lead.id,
        campaignId: lead.campaign_id,
        listId: lead.list_id,
        callId,
        gatewayId: resolved.gatewayId,
        agentId: lead.agent_id,
        to: LEAD_STATUS.DIALING,
        detail: { phone: dialed, source: "manual", gateway: resolved.gatewayName, attempt: attemptNo },
      });
    }

    let done = false;
    let ringback = null;
    let answered = false;
    let outcome = { causeCode: null, causeText: null };

    const bridge = client.Bridge();
    const outId = "out-" + browserChannel.id;
    const outLeg = client.Channel(outId);

    const end = async () => {
      if (done) return;
      done = true;
      try {
        await outLeg.hangup();
      } catch {
        /* gone */
      }
      try {
        await browserChannel.hangup();
      } catch {
        /* gone */
      }
      try {
        await bridge.destroy();
      } catch {
        /* gone */
      }

      if (!lead) return;
      const status = outcomeToStatus({
        answered,
        bridged: answered,
        causeCode: outcome.causeCode,
        causeText: outcome.causeText,
      });
      await W.finishCallRecord(db, callId, {
        status,
        // An answered manual call stays CONNECTED and claimed until the agent
        // saves the wrap-up — the disposition route writes the final status.
        leadStatus: answered ? LEAD_STATUS.CONNECTED : status,
        hangupCause: outcome.causeText || outcome.causeCode || null,
        employeeId: lead.agent_id,
      });
      if (answered) {
        await W.markConnected(db, { leadId: lead.id, agentId: lead.agent_id }).catch(() => {});
      } else {
        await W.finalizeLead(db, {
          leadId: lead.id,
          status,
          gatewayId: resolved.gatewayId,
        }).catch((e) => console.error("[ari][outbound] finalize failed: " + (e && e.message)));
      }
      log.log(answered ? EVENT.CONNECTED : EVENT.FAILED, {
        leadId: lead.id,
        campaignId: lead.campaign_id,
        callId,
        agentId: lead.agent_id,
        gatewayId: resolved.gatewayId,
        to: answered ? LEAD_STATUS.CONNECTED : status,
        detail: { cause: outcome.causeText || outcome.causeCode || "unknown", source: "manual" },
      });
    };

    outLeg.on("ChannelStateChange", (_e, ch) => {
      if (!lead || answered) return;
      const st = String((ch && ch.state) || "");
      if (st === "Ringing" || st === "Ring") {
        W.markRinging(db, lead.id).catch(() => {});
        W.markCallRinging(db, callId);
        log.log(EVENT.RINGING, {
          leadId: lead.id,
          campaignId: lead.campaign_id,
          callId,
          to: LEAD_STATUS.RINGING,
        });
      }
    });

    outLeg.on("StasisStart", async () => {
      if (done) return;
      answered = true;
      try {
        if (ringback) await ringback.stop();
      } catch {
        /* ignore */
      }
      try {
        await bridge.addChannel({ channel: outId });
      } catch {
        /* ignore */
      }
      console.log("[ari] outbound connected");

      if (lead) {
        await W.markCallAnswered(db, callId);
        await W.markCallConnected(db, callId, lead.agent_id);
      }

      const recOn = lead
        ? await isRecordingEnabledForCampaign(lead.campaign_id).catch(() => false)
        : await isRecordingEnabledForExtension(callerExt).catch(() => false);
      if (recOn) await startRecording(bridge, callerExt, dialed);
    });

    outLeg.on("StasisEnd", end);
    outLeg.on("ChannelDestroyed", (event) => {
      outcome = hangupInfo(event);
      end();
    });
    browserChannel.on("StasisEnd", end);
    browserChannel.on("ChannelDestroyed", end);

    try {
      await browserChannel.answer();
      await bridge.create({ type: "mixing" });
      await bridge.addChannel({ channel: browserChannel.id });
      try {
        ringback = await browserChannel.play({ media: "tone:ring" });
      } catch {
        /* ringback optional */
      }
      await outLeg.originate({
        channelId: outId,
        endpoint: "PJSIP/" + target + "@" + selectedTrunk,
        app: ariApp,
        appArgs: "dialed",
        callerId: callerId || dialed,
        timeout: 45,
      });
    } catch (err) {
      console.error("[ari] originate failed: " + (err && err.message));
      outcome = { causeCode: null, causeText: "originate-failed" };
      await end();
    }
  }

  /* ==================================================================
   *  INBOUND — trunk to the first READY agent
   * ================================================================== */

  async function handleInbound(client, trunkChannel) {
    const fromNumber = (trunkChannel.caller && trunkChannel.caller.number) || "unknown";

    let done = false;
    const bridge = client.Bridge();
    const brId = "in-" + trunkChannel.id;
    const browserLeg = client.Channel(brId);

    const end = async () => {
      if (done) return;
      done = true;
      try {
        await browserLeg.hangup();
      } catch {
        /* gone */
      }
      try {
        await trunkChannel.hangup();
      } catch {
        /* gone */
      }
      try {
        await bridge.destroy();
      } catch {
        /* gone */
      }
    };

    browserLeg.on("StasisStart", async () => {
      if (done) return;
      try {
        await trunkChannel.answer();
      } catch {
        /* ignore */
      }
      try {
        await bridge.addChannel({ channel: trunkChannel.id });
      } catch {
        /* ignore */
      }
      try {
        await bridge.addChannel({ channel: brId });
      } catch {
        /* ignore */
      }
      console.log("[ari] inbound connected from " + fromNumber);
    });

    browserLeg.on("StasisEnd", end);
    browserLeg.on("ChannelDestroyed", end);
    trunkChannel.on("StasisEnd", end);
    trunkChannel.on("ChannelDestroyed", end);

    try {
      await bridge.create({ type: "mixing" });

      // Prefer an agent the registry says is READY; fall back to any online
      // PJSIP endpoint, then to the configured default.
      let targetEndpoint = browserEndpoint;
      const readyExt = typeof handlers.pickInboundAgent === "function"
        ? handlers.pickInboundAgent()
        : null;
      if (readyExt) {
        targetEndpoint = readyExt;
        console.log("[ari] inbound routing to READY agent: " + targetEndpoint);
      } else {
        const endpoints = await listEndpoints().catch(() => null);
        const online =
          Array.isArray(endpoints) &&
          endpoints.find(
            (ep) => ep.resource && /^6\d+$/.test(ep.resource) && ep.state === "online",
          );
        if (online) {
          targetEndpoint = online.resource;
          console.log("[ari] inbound routing to online agent: " + targetEndpoint);
        } else {
          console.warn("[ari] no online agents found, trying default: " + targetEndpoint);
        }
      }

      await browserLeg.originate({
        channelId: brId,
        endpoint: "PJSIP/" + targetEndpoint,
        app: ariApp,
        appArgs: "tobrowser",
        callerId: fromNumber,
        timeout: 40,
      });
    } catch (err) {
      console.error("[ari] inbound originate failed: " + (err && err.message));
      await end();
    }
  }

  /* ==================================================================
   *  PREDICTIVE — the engine originates, an agent is chosen on answer
   * ================================================================== */

  /**
   * Originate the customer leg for one attempt. No agent is involved yet —
   * that is what allows the engine to over-dial safely.
   *
   * @param {object} o
   * @param {string} o.attemptId      also used as the ARI channel id
   * @param {number} o.campaignId
   * @param {number} o.leadId
   * @param {string} o.phone
   * @param {string} o.gatewayEndpoint
   * @param {number} [o.timeoutSec]
   * @param {boolean} [o.recordingEnabled]
   * @param {string|null} [o.amdContext] dialplan context that runs AMD() before
   *        handing the answered channel to Stasis; null = straight to Stasis
   */
  async function originateLead({
    attemptId,
    campaignId,
    leadId,
    phone,
    gatewayEndpoint,
    timeoutSec,
    recordingEnabled,
    amdContext,
  }) {
    if (!client) throw new Error("ARI not connected");
    if (!gatewayEndpoint) throw new Error("no gateway endpoint for campaign " + campaignId);

    const target = (outboundPrefix || "") + phone;
    const ch = client.Channel(attemptId);
    const info = {
      attemptId,
      campaignId,
      leadId,
      phone,
      gatewayEndpoint,
      recordingEnabled: Boolean(recordingEnabled),
      answered: false,
      bridged: false,
      finished: false,
      channel: ch,
    };
    predictive.set(attemptId, info);

    // Ringing is picked up by the client-level ChannelStateChange handler in
    // connect() — see the comment there for why a per-channel one cannot work.

    // Fires whether or not the customer ever answered — the single place the
    // attempt is reported as finished when no agent got involved.
    ch.on("ChannelDestroyed", (event) => {
      if (info.finished) return;
      info.finished = true;
      predictive.delete(attemptId);
      const { causeCode, causeText } = hangupInfo(event);
      handlers
        .onEnded(attemptId, { answered: info.answered, bridged: info.bridged, causeCode, causeText })
        .catch(() => {});
    });

    // Routing the answered channel through a dialplan context is what makes
    // AMD possible: Asterisk runs AMD() there and only then enters Stasis, so
    // handlePredictive can read AMDSTATUS. Without it we go straight to Stasis
    // and every answer is treated as a human.
    const route = amdContext
      ? { context: String(amdContext), extension: "s", priority: 1 }
      : { app: ariApp, appArgs: "predictive" };

    try {
      await ch.originate({
        channelId: attemptId,
        endpoint: "PJSIP/" + target + "@" + gatewayEndpoint,
        ...route,
        callerId: callerId || phone,
        timeout: Math.max(10, Number(timeoutSec) || 45),
      });
    } catch (e) {
      predictive.delete(attemptId);
      info.finished = true;
      throw e;
    }
    return attemptId;
  }

  /** The customer answered — ask the engine for an agent and bridge them in. */
  async function handlePredictive(client, gsmChannel) {
    const info = predictive.get(gsmChannel.id);
    if (!info) {
      try {
        await gsmChannel.hangup();
      } catch {
        /* gone */
      }
      return;
    }
    info.answered = true;

    // Answering-machine detection, when the dialplan provides it.
    const amd = await amdStatus(gsmChannel);
    if (amd === "MACHINE" || amd === "NOTSURE") {
      info.finished = true;
      predictive.delete(gsmChannel.id);
      try {
        await gsmChannel.hangup();
      } catch {
        /* gone */
      }
      await handlers.onEnded(info.attemptId, {
        answered: true,
        bridged: false,
        causeText: "amd-machine",
      });
      return;
    }

    const assigned = await handlers.onAnswered(info.attemptId).catch(() => null);
    if (!assigned || !assigned.agentExt) {
      // Nobody free — drop the call. The engine has already counted the
      // abandon and will throttle the ratio.
      info.finished = true;
      predictive.delete(gsmChannel.id);
      try {
        await gsmChannel.hangup();
      } catch {
        /* gone */
      }
      await handlers.onEnded(info.attemptId, {
        answered: true,
        bridged: false,
        causeText: "abandoned",
      });
      return;
    }

    const { agentId, agentExt } = assigned;
    let done = false;
    const bridge = client.Bridge();
    const agentLegId = "pred-agent-" + gsmChannel.id;
    const agentLeg = client.Channel(agentLegId);

    const end = async (event) => {
      if (done) return;
      done = true;
      const { causeCode, causeText } = hangupInfo(event);
      if (!info.finished) {
        info.finished = true;
        predictive.delete(gsmChannel.id);
        await handlers
          .onEnded(info.attemptId, {
            answered: true,
            bridged: info.bridged,
            causeCode,
            causeText: causeText || (info.bridged ? null : "ended-before-agent-connect"),
          })
          .catch(() => {});
      }
      try {
        await agentLeg.hangup();
      } catch {
        /* gone */
      }
      try {
        await gsmChannel.hangup();
      } catch {
        /* gone */
      }
      try {
        await bridge.destroy();
      } catch {
        /* gone */
      }
    };

    agentLeg.on("StasisStart", async () => {
      if (done) return;
      try {
        await gsmChannel.answer();
      } catch {
        /* ignore */
      }
      try {
        await bridge.addChannel({ channel: gsmChannel.id });
      } catch {
        /* ignore */
      }
      try {
        await bridge.addChannel({ channel: agentLegId });
      } catch {
        /* ignore */
      }
      console.log(`[ari] predictive connected -> agent ${agentExt}`);

      if (info.recordingEnabled) await startRecording(bridge, agentExt, info.phone);

      info.bridged = true; // set BEFORE notifying so end() cannot double-release
      await handlers.onBridged(info.attemptId, agentId).catch(() => {});
    });

    agentLeg.on("StasisEnd", () => end());
    agentLeg.on("ChannelDestroyed", (event) => end(event));
    gsmChannel.on("StasisEnd", () => end());
    gsmChannel.on("ChannelDestroyed", (event) => end(event));

    try {
      await bridge.create({ type: "mixing" });
      await agentLeg.originate({
        channelId: agentLegId,
        endpoint: "PJSIP/" + agentExt,
        app: ariApp,
        appArgs: "pred-agent",
        callerId: info.phone,
        timeout: 30,
      });
    } catch (e) {
      console.error("[ari] agent originate failed: " + (e && e.message));
      await end({ cause_txt: "agent-unavailable" });
    }
  }

  /* ==================================================================
   *  Public surface
   * ================================================================== */

  /** All PJSIP endpoints and their state — used by the gateway health check. */
  async function listEndpoints() {
    const res = await fetch(`${ariUrl}/ari/endpoints/PJSIP`, { headers: authHeader });
    if (!res.ok) throw new Error(`ARI endpoints HTTP ${res.status}`);
    return await res.json();
  }

  /** Force-hang up an attempt (used by the engine's stale-attempt sweep). */
  async function hangup(attemptId) {
    const info = predictive.get(attemptId);
    if (info && info.channel) {
      try {
        await info.channel.hangup();
        return true;
      } catch {
        /* already gone */
      }
    }
    if (!client) return false;
    try {
      await client.channels.hangup({ channelId: attemptId });
      return true;
    } catch {
      return false;
    }
  }

  function setHandlers(h) {
    if (!h) return;
    if (h.onRinging) handlers.onRinging = h.onRinging;
    if (h.onAnswered) handlers.onAnswered = h.onAnswered;
    if (h.onBridged) handlers.onBridged = h.onBridged;
    if (h.onEnded) handlers.onEnded = h.onEnded;
    if (h.pickInboundAgent) handlers.pickInboundAgent = h.pickInboundAgent;
  }

  connect();

  return {
    originateLead,
    setHandlers,
    listEndpoints,
    hangup,
    isConnected: () => !!client,
  };
};

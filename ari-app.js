/* =====================================================================
 *  ari-app.js  -  Asterisk ARI call control for Next.js project
 *
 *  Gateway selection is DYNAMIC: the outbound trunk is looked up from
 *  the database based on which employee (SIP extension) is calling and
 *  which campaign they are assigned to. Nothing is hardcoded.
 *
 *  Chain:  extension -> users.id -> campaign_assignments -> campaign_gateways
 *          -> gsm_gateways.asterisk_endpoint  (e.g. "gw1")
 * ===================================================================== */

"use strict";

const ari = require("ari-client");
const mysql = require("mysql2/promise");

// ---------------------------------------------------------------------
//  MySQL connection pool (reads the same .env that server.mjs loaded).
//  This is infrastructure config, not business data, so it lives in .env.
// ---------------------------------------------------------------------

module.exports = function startAri(config) {
  const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });
  console.log(
    `[ari] DB pool: ${process.env.DB_USER}@${process.env.DB_HOST}/${process.env.DB_NAME}`,
  );
  const {
    ariUrl,
    ariUser,
    ariPass,
    ariApp,
    trunkEndpoint, // fallback only — used if DB lookup finds nothing
    browserEndpoint,
    outboundPrefix,
    callerId,
  } = config;

  // Make fetch available (Node 18+ has it built-in)
  const fetch = globalThis.fetch || require("node-fetch");

  // -------------------------------------------------------------------
  //  Look up the active outbound gateway for a given SIP extension.
  //  Returns the asterisk_endpoint string (e.g. "gw1") or null.
  // -------------------------------------------------------------------
  async function getGatewayForExtension(extension) {
    const [rows] = await db.query(
      `SELECT g.asterisk_endpoint AS endpoint
         FROM employees e
         JOIN campaign_assignments ca ON ca.employee_id = e.user_id
         JOIN campaign_gateways cg     ON cg.campaign_id = ca.campaign_id
         JOIN gsm_gateways g           ON g.id = cg.gateway_id
        WHERE e.sip_extension = ? AND g.status = 'active'
        LIMIT 1`,
      [extension],
    );
    return rows[0] ? rows[0].endpoint : null;
  }

  function connect() {
    ari
      .connect(ariUrl, ariUser, ariPass)
      .then((client) => {
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
          }
        });

        client.on("WebSocketError", (err) =>
          console.error("[ari] websocket error: " + (err && err.message)),
        );

        client.start(ariApp);
        console.log("[ari] connected to " + ariUrl + ' app="' + ariApp + '"');
      })
      .catch((err) => {
        console.error("[ari] connection failed: " + (err && err.message));
        console.error("[ari] retrying in 5s...");
        setTimeout(connect, 5000);
      });
  }

  /* ------------------------------------------------------------------
   *  OUTBOUND  -  browser -> GSM gateway trunk
   * ------------------------------------------------------------------ */
  async function handleOutbound(client, browserChannel) {
    const dialed =
      (browserChannel.dialplan && browserChannel.dialplan.exten) || "";
    const target = (outboundPrefix || "") + dialed;

    // ----------------------------------------------------------------
    //  DYNAMIC gateway selection.
    //  Figure out which employee is calling from the channel name
    //  (e.g. "PJSIP/6001-00000004"), then look up their campaign's
    //  gateway in the database. Falls back to the .env default only
    //  if nothing is found.
    // ----------------------------------------------------------------
    const extMatch = (browserChannel.name || "").match(/PJSIP\/(\d+)-/);
    const callerExt = extMatch ? extMatch[1] : null;

    let selectedTrunk = trunkEndpoint; // fallback .env default
    if (callerExt) {
      try {
        const gw = await getGatewayForExtension(callerExt);
        if (gw) {
          selectedTrunk = gw;
          console.log(
            `[ari] ext ${callerExt} -> gateway ${selectedTrunk} (from DB)`,
          );
        } else {
          console.warn(
            `[ari] ext ${callerExt}: no gateway in DB, default ${selectedTrunk}`,
          );
        }
      } catch (e) {
        console.error("[ari] gateway lookup failed: " + (e && e.message));
      }
    } else {
      console.warn("[ari] could not parse extension from channel name");
    }

    let done = false;
    let ringback = null;

    const bridge = client.Bridge();
    const outId = "out-" + browserChannel.id;
    const outLeg = client.Channel(outId);

    const end = async () => {
      if (done) return;
      done = true;
      try {
        await outLeg.hangup();
      } catch (e) {
        /* gone */
      }
      try {
        await browserChannel.hangup();
      } catch (e) {
        /* gone */
      }
      try {
        await bridge.destroy();
      } catch (e) {
        /* gone */
      }
    };

    // Far end answered -> stop ringback then bridge
    outLeg.on("StasisStart", async () => {
      if (done) return;
      try {
        if (ringback) await ringback.stop();
      } catch (e) {
        /* ignore */
      }
      try {
        await bridge.addChannel({ channel: outId });
      } catch (e) {
        /* ignore */
      }
      console.log("[ari] outbound connected");
    });

    outLeg.on("StasisEnd", end);
    outLeg.on("ChannelDestroyed", end);
    browserChannel.on("StasisEnd", end);
    browserChannel.on("ChannelDestroyed", end);

    try {
      // Answer browser leg, create bridge, play ringback
      await browserChannel.answer();
      await bridge.create({ type: "mixing" });
      await bridge.addChannel({ channel: browserChannel.id });

      // Play ringback via Asterisk (stops early media leaking)
      try {
        ringback = await browserChannel.play({ media: "tone:ring" });
      } catch (e) {
        /* ringback optional */
      }

      // Originate outbound call through the selected (dynamic) gateway
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
      await end();
    }
  }

  /* ------------------------------------------------------------------
   *  INBOUND  -  Dinstar trunk -> browser
   * ------------------------------------------------------------------ */
  async function handleInbound(client, trunkChannel) {
    const fromNumber =
      (trunkChannel.caller && trunkChannel.caller.number) || "unknown";

    let done = false;
    const bridge = client.Bridge();
    const brId = "in-" + trunkChannel.id;
    const browserLeg = client.Channel(brId);

    const end = async () => {
      if (done) return;
      done = true;
      try {
        await browserLeg.hangup();
      } catch (e) {
        /* gone */
      }
      try {
        await trunkChannel.hangup();
      } catch (e) {
        /* gone */
      }
      try {
        await bridge.destroy();
      } catch (e) {
        /* gone */
      }
    };

    // Browser answered -> bridge both legs
    browserLeg.on("StasisStart", async () => {
      if (done) return;
      try {
        await trunkChannel.answer();
      } catch (e) {
        /* ignore */
      }
      try {
        await bridge.addChannel({ channel: trunkChannel.id });
      } catch (e) {
        /* ignore */
      }
      try {
        await bridge.addChannel({ channel: brId });
      } catch (e) {
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

      // Find first online agent endpoint dynamically via ARI
      let targetEndpoint = browserEndpoint; // fallback to .env default
      try {
        const res = await fetch(`${ariUrl}/ari/endpoints/PJSIP`, {
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(`${ariUser}:${ariPass}`).toString("base64"),
          },
        });
        if (res.ok) {
          const endpoints = await res.json();
          // Find first online agent (extension starts with 6)
          const online = endpoints.find(
            (ep) =>
              ep.resource &&
              /^6\d+$/.test(ep.resource) &&
              ep.state === "online",
          );
          if (online) {
            targetEndpoint = online.resource;
            console.log(
              "[ari] inbound routing to online agent: " + targetEndpoint,
            );
          } else {
            console.warn(
              "[ari] no online agents found, trying default: " + targetEndpoint,
            );
          }
        }
      } catch (e) {
        console.warn(
          "[ari] could not query endpoints, using default:",
          e && e.message,
        );
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
      console.error("[ari] inbound originate failed: " + JSON.stringify(err));
      await end();
    }
  }

  connect();
};

/* =====================================================================
 *  predictive-engine.js — VICIdial-style server-side dialer.
 *
 *  The loop, forever:
 *
 *    1. find READY agents per campaign          (agentRegistry)
 *    2. work out how many lines to open         (per MODE — see below)
 *    3. turn that into free dialing capacity    (target - live lines,
 *                                                capped by gateway channels)
 *    4. claim that many eligible leads          (dialEligibility, one txn)
 *    5. dial them through the gateway pool      (balancing + failover)
 *    6. update lead + call-history status immediately at every step
 *    7. repeat
 *
 *  The server places the call; the agent only ever sees a customer who has
 *  already answered. Nothing is pre-bound: an agent is chosen at the moment
 *  the customer picks up, which is what makes over-dialing possible without
 *  stranding agents on ringing lines.
 *
 *  ---- MODE IS A CONTRACT (src/lib/dialerModes.js) ---------------------
 *
 *  MANUAL and INBOUND campaigns are never touched: the loop skips them
 *  before claiming, before pacing and before dialing, and it removes their
 *  agents from the pacing pool so a mode change takes effect on the very next
 *  tick rather than when someone reloads a browser tab.
 *
 *  RATIO campaigns open a FIXED dial_ratio × ready-agents lines. No answer
 *  rate, no handle time, no forecast — a ratio dialer that adapted would just
 *  be a predictive dialer with a confusing name.
 *
 *  PREDICTIVE campaigns are the only ones that run the adaptive algorithm in
 *  `predictiveCapacity()`: it forecasts how many agents will be free by the
 *  time a fresh call is answered, divides by the measured answer rate to get
 *  the lines needed, and holds itself under the campaign's abandon budget.
 *
 *  Every one of those rules is asserted at the point of use, not just at the
 *  top of the loop, so no future call path can quietly dial for the wrong
 *  kind of campaign.
 *
 *  Safety properties:
 *   · a customer is never called twice at once (per-phone in-flight lock)
 *   · a number is never re-dialed inside the cooldown window
 *   · every claim carries a TTL and self-heals (recoverStaleLeads)
 *   · one failure never stops the loop; every skip logs a reason
 *   · ARI down -> the loop keeps running but stops originating
 *
 *  Tunables live in the `settings` table (global) and on each campaign row
 *  (per-campaign). Both are re-read while running — no restart needed.
 * ===================================================================== */
"use strict";

const mysql = require("mysql2/promise");

const {
  LEAD_STATUS,
  normalizeStatus,
  outcomeToStatus,
  parseDialStatuses,
  parseRecycleRules,
} = require("./src/lib/leadStatus.js");
const {
  normalizeMode,
  isEngineDriven,
  isPredictive,
  labelFor,
} = require("./src/lib/dialerModes.js");
const { predictiveTarget, ratioTarget } = require("./src/lib/pacing.js");
const { buildClaimSelect } = require("./src/lib/dialEligibility.js");
const { createDialerLog, EVENT } = require("./src/lib/dialerLog.js");
const { createGatewayPool } = require("./src/lib/gatewayPool.js");
const W = require("./src/lib/leadWriter.js");

/**
 * @param {object} o
 * @param {import('socket.io').Server} o.io
 * @param {ReturnType<typeof import('./src/lib/agentRegistry.js').createAgentRegistry>} o.registry
 * @param {{originateLead:Function,setHandlers:Function,isConnected:Function,hangup:Function}} o.ari
 */
module.exports = function startPredictiveEngine({ io, registry, ari }) {
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

  const log = createDialerLog(db, { tag: "DIALER" });
  const { AGENT_STATE } = registry;

  /* ---------------- configuration ---------------- */

  const cfg = {
    enabled: true,
    tickMs: 1000,
    ratio: 1,
    phoneCooldownSec: 60,
    claimTimeoutSec: 120,
    onCallTimeoutSec: 1800,
    wrapupTimeoutSec: 900,
    ringingTimeoutSec: 90,
    gatewayHealthSec: 20,
    gatewayFailThreshold: 3,
    gatewayCooldownSec: 60,
    maxAbandonPct: 3,
    callbackLookaheadMin: 5,
    // Answering-machine detection. Off by default: it needs the
    // [predictive-amd] context in extensions.conf on the Asterisk box.
    amdEnabled: false,
    amdContext: "predictive-amd",
  };

  const numOr = (v, d) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };

  async function refreshConfig() {
    try {
      const [rows] = await db.query(
        `SELECT setting_key, setting_value FROM settings
          WHERE setting_key LIKE 'dialer%'
             OR setting_key IN ('predictive_ratio','phone_cooldown_seconds')`,
      );
      const m = {};
      for (const r of rows) m[r.setting_key] = r.setting_value;
      cfg.enabled = m.dialer_enabled === undefined ? true : String(m.dialer_enabled) !== "0";
      cfg.tickMs = Math.max(250, numOr(m.dialer_tick_ms, 1000));
      cfg.ratio = Math.max(1, numOr(m.predictive_ratio, 1));
      cfg.phoneCooldownSec = numOr(m.phone_cooldown_seconds, 60);
      cfg.claimTimeoutSec = Math.max(30, numOr(m.dialer_claim_timeout_sec, 120));
      cfg.onCallTimeoutSec = Math.max(120, numOr(m.dialer_oncall_timeout_sec, 1800));
      cfg.wrapupTimeoutSec = Math.max(60, numOr(m.dialer_wrapup_timeout_sec, 900));
      cfg.ringingTimeoutSec = Math.max(30, numOr(m.dialer_ringing_timeout_sec, 90));
      cfg.gatewayHealthSec = Math.max(5, numOr(m.dialer_gateway_health_sec, 20));
      cfg.gatewayFailThreshold = Math.max(1, numOr(m.dialer_gateway_fail_threshold, 3));
      cfg.gatewayCooldownSec = Math.max(5, numOr(m.dialer_gateway_cooldown_sec, 60));
      cfg.maxAbandonPct = numOr(m.dialer_max_abandon_pct, 3);
      cfg.callbackLookaheadMin = numOr(m.dialer_callback_lookahead_min, 5);
      cfg.amdEnabled = String(m.dialer_amd_enabled || "0") === "1";
      cfg.amdContext = String(m.dialer_amd_context || "predictive-amd").slice(0, 60);
    } catch (e) {
      log.error("config refresh failed", e);
    }
  }

  /** Campaign rows, cached briefly so a tick does not hammer the DB. */
  const campaignCache = new Map();
  const CAMPAIGN_TTL_MS = 5000;

  async function campaignConfig(campaignId) {
    const hit = campaignCache.get(campaignId);
    if (hit && Date.now() - hit.at < CAMPAIGN_TTL_MS) return hit.row;
    const [rows] = await db.query(
      `SELECT id, name, status, dialer_type, dial_statuses, recycle_rules,
              disposition_rules, retry_count, retry_delay_minutes, dial_ratio,
              dial_timeout_sec, wrapup_seconds, lead_order, callbacks_enabled,
              max_abandon_pct, recording_enabled, calling_start, calling_end
         FROM campaigns WHERE id = ?`,
      [campaignId],
    );
    const row = rows[0] || null;
    campaignCache.set(campaignId, { at: Date.now(), row });
    return row;
  }

  /* ---------------- in-memory call state ---------------- */

  /**
   * attemptId -> {
   *   id, campaignId, listId, leadId, phone, contactName, customFields,
   *   gatewayId, gatewayEndpoint, callId, attemptNo, viaRecycle, dialSource,
   *   preferredAgentId, agentId, agentExt,
   *   state: 'dialing'|'ringing'|'answered'|'connected'|'ended',
   *   startedAt, answeredAt, connectedAt, triedGatewayIds
   * }
   */
  const attempts = new Map();
  /** phone -> attemptId, so one customer is never on two of our lines. */
  const phoneLocks = new Map();
  /** phone -> epoch ms the last attempt to that number finished. */
  const phoneCooldown = new Map();
  /** campaignId -> { answered, abandoned } over a rolling window. */
  const pacingStats = new Map();
  /** leadId -> attemptId, so an in-flight lead is never re-claimed locally. */
  const leadLocks = new Map();

  let attemptSeq = 0;
  const nextAttemptId = () => `a${Date.now().toString(36)}${(attemptSeq++).toString(36)}`;

  const normPhone = (p) => String(p || "").replace(/[^\d+]/g, "");

  /**
   * Rolling per-campaign measurements. These are the inputs the predictive
   * algorithm forecasts from; a ratio campaign accumulates them too (they are
   * what the dashboard reports) but never paces on them.
   *
   *   attempts    dials placed
   *   answered    customers who picked up
   *   abandoned   answered with no agent to take them
   *   ringSec     dial -> answer, i.e. how far ahead a predictive dial must aim
   *   handleSec   answer -> agent free again (talk + the wrap-up breather)
   */
  function statsFor(campaignId) {
    let s = pacingStats.get(campaignId);
    if (!s) {
      s = {
        attempts: 0,
        answered: 0,
        abandoned: 0,
        ringSecSum: 0,
        ringSamples: 0,
        handleSecSum: 0,
        handleSamples: 0,
        // The last pacing decision, so the live dashboard can show the figure
        // the engine is actually applying rather than the configured one.
        lastRatio: null,
        lastTarget: null,
        since: Date.now(),
      };
      pacingStats.set(campaignId, s);
    }
    // Roll the window every 15 minutes so an old spike stops throttling us,
    // and so the averages track the shift the team is actually working.
    if (Date.now() - s.since > 15 * 60_000) {
      s.attempts = Math.round(s.attempts / 2);
      s.answered = Math.round(s.answered / 2);
      s.abandoned = Math.round(s.abandoned / 2);
      s.ringSecSum = Math.round(s.ringSecSum / 2);
      s.ringSamples = Math.round(s.ringSamples / 2);
      s.handleSecSum = Math.round(s.handleSecSum / 2);
      s.handleSamples = Math.round(s.handleSamples / 2);
      s.since = Date.now();
    }
    return s;
  }

  /** Samples below this are too thin to forecast from — pace progressively. */
  const MIN_PACING_SAMPLES = 20;

  function abandonPct(campaignId) {
    const s = statsFor(campaignId);
    const total = s.answered + s.abandoned;
    return total < 10 ? 0 : (s.abandoned / total) * 100;
  }

  /**
   * Share of dials a human picks up, over the rolling window.
   *
   * Returns 1 until there is enough evidence: a fresh campaign then opens one
   * line per expected free agent (progressive), which is the only safe way to
   * start — over-dialing on a guessed answer rate is what produces the burst
   * of dropped calls at the top of a shift.
   */
  function answerRate(campaignId) {
    const s = statsFor(campaignId);
    if (s.attempts < MIN_PACING_SAMPLES) return 1;
    const rate = s.answered / s.attempts;
    // Floor it: a 2% answer rate would otherwise ask for 50 lines per agent.
    return Math.min(1, Math.max(0.05, rate));
  }

  /** Mean seconds from dial to answer — how far ahead predictive must aim. */
  function avgRingSec(campaignId) {
    const s = statsFor(campaignId);
    if (s.ringSamples < 5) return 12; // sane default until measured
    return Math.max(1, s.ringSecSum / s.ringSamples);
  }

  /** Mean seconds an answered call keeps an agent busy (talk + wrap-up). */
  function avgHandleSec(campaignId) {
    const s = statsFor(campaignId);
    if (s.handleSamples < 5) return 180;
    return Math.max(5, s.handleSecSum / s.handleSamples);
  }

  function liveAttemptsFor(campaignId) {
    let n = 0;
    for (const a of attempts.values()) {
      if (a.campaignId === campaignId && a.state !== "ended") n++;
    }
    return n;
  }

  const gateways = createGatewayPool({
    db,
    log,
    ari,
    config: () => ({
      failThreshold: cfg.gatewayFailThreshold,
      cooldownSec: cfg.gatewayCooldownSec,
      healthSec: cfg.gatewayHealthSec,
    }),
  });

  /* ---------------- lead claiming ---------------- */

  /**
   * Claim up to `want` dialable leads for a campaign in one transaction.
   * Every claimed lead is written to QUEUED with a live claim, so no other
   * worker (or this loop's next tick) can pick it up.
   */
  async function claimLeads(campaign, want) {
    const campaignId = campaign.id;

    // Mode guard, repeated at the point of use: claiming reserves the lead and
    // takes it out of everyone else's queue, so a manual campaign must not
    // reach this even if a future caller forgets the check in the loop.
    if (!isEngineDriven(campaign.dialer_type)) {
      return { leads: [], reason: "ModeNotEngineDriven" };
    }

    const [listRows] = await db.query(
      "SELECT id FROM lists WHERE campaign_id = ? AND active = 'Y'",
      [campaignId],
    );
    if (listRows.length === 0) return { leads: [], reason: "NoActiveLists" };

    const claim = buildClaimSelect({
      campaignId,
      listIds: listRows.map((l) => l.id),
      dialStatuses: parseDialStatuses(campaign.dial_statuses),
      recycleRules: parseRecycleRules(campaign.recycle_rules, campaign.retry_delay_minutes),
      dispositionRules: campaign.disposition_rules,
      claimTimeoutSec: cfg.claimTimeoutSec,
      maxAttempts: Number(campaign.retry_count) || 0,
      leadOrder: campaign.lead_order,
      limit: want,
      excludeIds: [...leadLocks.keys()],
    });
    if (!claim) return { leads: [], reason: "NoDialableStatuses" };

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(claim.sql, claim.params);
      const picked = [];
      for (const lead of rows) {
        const phone = normPhone(lead.phone_number);
        if (!phone) continue;
        if (phoneLocks.has(phone)) continue; // same customer already on a line
        const last = phoneCooldown.get(phone);
        if (last && Date.now() - last < cfg.phoneCooldownSec * 1000) continue;
        // assigned_to is preserved: on an agent callback it names the agent who
        // booked it, and onAnswered prefers that seat.
        await W.reserveLead(conn, {
          leadId: lead.id,
          agentId: lead.assigned_to || null,
          currentStatus: lead.call_status,
        });
        picked.push(lead);
      }
      await conn.commit();
      return { leads: picked, reason: rows.length === 0 ? "NoContacts" : null };
    } catch (e) {
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
      log.error("claim failed", e, { campaign: campaignId });
      return { leads: [], reason: "ClaimError" };
    } finally {
      conn.release();
    }
  }

  /* ---------------- dialing ---------------- */

  /**
   * Place one outbound attempt for an already-claimed lead. Tries each
   * available gateway in turn — a gateway that refuses the call is reported
   * and the attempt moves to the next one (requirement: automatic failover).
   */
  async function dialLead(campaign, lead, opts) {
    const campaignId = campaign.id;
    const phone = normPhone(lead.phone_number);
    const mode = normalizeMode(campaign.dialer_type);
    const preferredAgentId = (opts && opts.preferredAgentId) || null;

    // The last gate before a customer's phone rings. Anything that reaches
    // here for a mode the server does not dial for is a bug, so it is logged
    // loudly and refused rather than quietly skipped.
    if (!isEngineDriven(mode)) {
      log.error("refused to originate for a non-engine-driven campaign", null, {
        campaign: campaignId,
        mode,
        lead: lead.id,
      });
      await W.cancelReservation(db, lead.id).catch(() => {});
      return false;
    }

    const dialSource = (opts && opts.dialSource) || mode;

    log.log(EVENT.SELECTED, {
      leadId: lead.id,
      campaignId,
      listId: lead.list_id,
      from: normalizeStatus(lead.call_status),
      to: LEAD_STATUS.QUEUED,
      detail: { phone, attempt: (Number(lead.call_count) || 0) + 1, recycle: lead.via_recycle ? 1 : 0 },
    });

    phoneLocks.set(phone, "pending");
    leadLocks.set(lead.id, "pending");

    // ONE contact attempt = one call_count increment and one call-history row,
    // however many gateways we have to walk through to place it. Failover hops
    // are recorded in dialer_log, not as extra attempts against the customer.
    const dial = await W.markDialing(db, {
      leadId: lead.id,
      gatewayId: null,
      viaRecycle: Number(lead.via_recycle) === 1,
      agentId: null,
    });
    const callId = await W.startCallRecord(db, {
      employeeId: null,
      campaignId,
      leadId: lead.id,
      listId: lead.list_id,
      gatewayId: null,
      phoneNumber: lead.phone_number,
      contactName: lead.name,
      dialSource,
      attemptNo: dial.attemptNo,
    });

    if (Number(lead.via_recycle) === 1) {
      log.log(EVENT.RETRY_ATTEMPT, {
        leadId: lead.id,
        campaignId,
        listId: lead.list_id,
        callId,
        detail: { attempt: dial.attemptNo, recycleAttempts: lead.recycle_attempts },
      });
    }

    const tried = [];
    let gw = null;
    let attempt = null;

    try {
      for (let hop = 0; hop < 3; hop++) {
        gw = await gateways.acquire(campaignId, tried);
        if (!gw) break;
        tried.push(gw.id);

        const attemptId = nextAttemptId();
        attempt = {
          id: attemptId,
          campaignId,
          listId: lead.list_id,
          leadId: lead.id,
          phone,
          contactName: lead.name,
          customFields: lead.custom_fields,
          email: lead.email,
          company: lead.company,
          gatewayId: gw.id,
          gatewayEndpoint: gw.endpoint,
          callId,
          attemptNo: dial.attemptNo,
          viaRecycle: Number(lead.via_recycle) === 1,
          dialSource,
          preferredAgentId,
          agentId: null,
          agentExt: null,
          state: "dialing",
          startedAt: Date.now(),
          answeredAt: null,
          connectedAt: null,
          triedGatewayIds: tried.slice(),
        };
        attempts.set(attemptId, attempt);
        phoneLocks.set(phone, attemptId);
        leadLocks.set(lead.id, attemptId);

        try {
          await ari.originateLead({
            attemptId,
            campaignId,
            leadId: lead.id,
            phone: lead.phone_number,
            gatewayEndpoint: gw.endpoint,
            timeoutSec: Number(campaign.dial_timeout_sec) || 45,
            recordingEnabled: Number(campaign.recording_enabled) === 1,
            amdContext: cfg.amdEnabled ? cfg.amdContext : null,
          });
        } catch (e) {
          // This gateway refused the call. Report it, free the channel and let
          // the loop try the next gateway for the same contact.
          gateways.reportFailure(gw.id, (e && e.message) || "originate-error");
          gateways.release(gw.id);
          attempts.delete(attemptId);
          log.log(EVENT.GATEWAY_DOWN, {
            leadId: lead.id,
            campaignId,
            callId,
            gatewayId: gw.id,
            detail: { hop: hop + 1, reason: (e && e.message) || "originate-error" },
          });
          attempt = null;
          continue;
        }

        // Stamp the gateway that actually carried the attempt.
        await db
          .query("UPDATE csv_data SET last_gateway_id = ? WHERE id = ?", [gw.id, lead.id])
          .catch(() => {});
        await db
          .query("UPDATE calls SET gateway_id = ?, channel_id = ? WHERE id = ?", [
            gw.id,
            attemptId,
            callId,
          ])
          .catch(() => {});

        // One more line opened — the denominator of the answer rate the
        // predictive forecast divides by.
        statsFor(campaignId).attempts++;

        log.log(EVENT.DIAL_STARTED, {
          leadId: lead.id,
          campaignId,
          listId: lead.list_id,
          callId,
          gatewayId: gw.id,
          from: LEAD_STATUS.QUEUED,
          to: LEAD_STATUS.DIALING,
          detail: { phone, gateway: gw.name, endpoint: gw.endpoint, attempt: dial.attemptNo, source: dialSource },
        });
        return true;
      }

      // No gateway could carry it — close the attempt and put the lead back on
      // the redial queue instead of leaving it stuck on DIALING.
      const reason = tried.length === 0 ? "no-gateway" : "gateway-unavailable";
      const plan = await W.finalizeLead(db, {
        leadId: lead.id,
        status: LEAD_STATUS.FAILED,
        campaign,
      }).catch((e) => {
        log.error("finalize (no gateway) failed", e, { lead: lead.id });
        return null;
      });
      await W.finishCallRecord(db, callId, {
        status: LEAD_STATUS.FAILED,
        leadStatus: (plan && plan.status) || LEAD_STATUS.FAILED,
        hangupCause: reason,
      });
      log.log(EVENT.FAILED, {
        leadId: lead.id,
        campaignId,
        listId: lead.list_id,
        callId,
        to: (plan && plan.status) || LEAD_STATUS.FAILED,
        detail: { reason, triedGateways: tried.join(",") || "none" },
      });
      if (plan && plan.willRetry) {
        log.log(EVENT.RETRY_SCHEDULED, {
          leadId: lead.id,
          campaignId,
          to: plan.status,
          detail: { at: plan.nextRetryAt, delayMin: plan.delayMin, reason },
        });
      }
      return false;
    } finally {
      if (!attempt) {
        phoneLocks.delete(phone);
        leadLocks.delete(lead.id);
        phoneCooldown.set(phone, Date.now());
      }
    }
  }

  /* ---------------- ARI callbacks ---------------- */

  /** The customer's phone started ringing. */
  async function onRinging(attemptId) {
    const a = attempts.get(attemptId);
    if (!a || a.state !== "dialing") return;
    a.state = "ringing";
    await W.markRinging(db, a.leadId).catch(() => {});
    await W.markCallRinging(db, a.callId);
    log.log(EVENT.RINGING, {
      leadId: a.leadId,
      campaignId: a.campaignId,
      listId: a.listId,
      callId: a.callId,
      gatewayId: a.gatewayId,
      from: LEAD_STATUS.DIALING,
      to: LEAD_STATUS.RINGING,
    });
  }

  /**
   * The customer answered. Pick the agent to bridge in — this is the moment
   * that makes over-dialing safe. Returning null tells ARI to drop the call
   * (an abandon), which is counted and throttles the ratio.
   */
  async function onAnswered(attemptId) {
    const a = attempts.get(attemptId);
    if (!a || a.state === "ended") return null;
    a.state = "answered";
    a.answeredAt = Date.now();
    const ringSec = (a.answeredAt - a.startedAt) / 1000;
    const stats = statsFor(a.campaignId);
    stats.answered++;
    // How long a dial takes to reach a human: the horizon the predictive
    // forecast aims at.
    stats.ringSecSum += ringSec;
    stats.ringSamples++;

    await W.markCallAnswered(db, a.callId);
    log.log(EVENT.ANSWERED, {
      leadId: a.leadId,
      campaignId: a.campaignId,
      listId: a.listId,
      callId: a.callId,
      gatewayId: a.gatewayId,
      detail: { ringSec: Math.round((a.answeredAt - a.startedAt) / 1000) },
    });
    gateways.reportSuccess(a.gatewayId);

    // Prefer the agent who booked the callback, then the longest-idle agent.
    const ready = registry.readyFor(a.campaignId);
    let agent = null;
    if (a.preferredAgentId) agent = ready.find((x) => x.id === a.preferredAgentId) || null;
    if (!agent) agent = ready[0] || null;

    if (!agent) {
      statsFor(a.campaignId).abandoned++;
      log.log(EVENT.ABANDONED, {
        leadId: a.leadId,
        campaignId: a.campaignId,
        listId: a.listId,
        callId: a.callId,
        detail: { reason: "no-ready-agent", abandonPct: abandonPct(a.campaignId).toFixed(1) },
      });
      return null;
    }

    // Take the agent out of the ready pool immediately so two simultaneous
    // answers can never be routed to the same seat.
    a.agentId = agent.id;
    a.agentExt = agent.extension;
    registry.setState(agent.id, AGENT_STATE.INCALL, {
      leadId: a.leadId,
      callId: a.callId,
      gatewayId: a.gatewayId,
      reason: "call-answered",
    });
    return { agentId: agent.id, agentExt: agent.extension };
  }

  /** The agent's leg is bridged to the customer — pop the screen. */
  async function onBridged(attemptId) {
    const a = attempts.get(attemptId);
    if (!a || a.state === "ended" || !a.agentId) return;
    a.state = "connected";
    a.connectedAt = Date.now();

    await W.markConnected(db, { leadId: a.leadId, agentId: a.agentId }).catch(() => {});
    await W.markCallConnected(db, a.callId, a.agentId);

    log.log(EVENT.CONNECTED, {
      leadId: a.leadId,
      campaignId: a.campaignId,
      listId: a.listId,
      callId: a.callId,
      agentId: a.agentId,
      gatewayId: a.gatewayId,
      from: LEAD_STATUS.RINGING,
      to: LEAD_STATUS.CONNECTED,
    });

    io.to("agent:" + a.agentId).emit("assigned-call", {
      id: a.leadId,
      phone_number: a.phone,
      name: a.contactName,
      email: a.email,
      company: a.company,
      custom_fields: a.customFields,
      call_id: a.callId,
      campaign_id: a.campaignId,
      list_id: a.listId,
    });
  }

  /**
   * The attempt is over. Lands the lead on a real status, schedules the redial
   * when the rules allow one, and closes the call-history row.
   */
  async function onEnded(attemptId, outcome) {
    const a = attempts.get(attemptId);
    if (!a) return;
    if (a.state === "ended") return;
    a.state = "ended";
    attempts.delete(attemptId);

    const o = outcome || {};
    const answered = Boolean(o.answered || a.answeredAt);
    const bridged = Boolean(o.bridged || a.connectedAt);

    gateways.release(a.gatewayId);
    phoneLocks.delete(a.phone);
    leadLocks.delete(a.leadId);
    phoneCooldown.set(a.phone, Date.now());

    const status = outcomeToStatus({
      answered,
      bridged,
      causeCode: o.causeCode,
      causeText: o.causeText,
    });

    // A call the agent actually took stays CONNECTED and claimed until the
    // wrap-up is saved — the disposition route owns the final word on it.
    if (bridged && a.agentId) {
      // Handle time = how long this call kept a seat occupied: the talk time
      // plus the wrap-up breather the campaign gives afterwards. It is what
      // the predictive forecast uses to tell which agents are about to free
      // up, so it is sampled from the real call rather than configured.
      const talkSec = (Date.now() - (a.connectedAt || a.answeredAt || Date.now())) / 1000;
      const campaignForHandle = await campaignConfig(a.campaignId).catch(() => null);
      const wrapSec = Number(campaignForHandle && campaignForHandle.wrapup_seconds) || 0;
      const hs = statsFor(a.campaignId);
      hs.handleSecSum += talkSec + wrapSec;
      hs.handleSamples++;

      await W.finishCallRecord(db, a.callId, {
        status,
        leadStatus: LEAD_STATUS.CONNECTED,
        hangupCause: o.causeText || o.causeCode || null,
        employeeId: a.agentId,
      });
      await W.touchClaim(db, a.leadId).catch(() => {});
      registry.setState(a.agentId, AGENT_STATE.WRAPUP, { reason: "call-ended" });
      log.log(EVENT.DISPOSITION, {
        leadId: a.leadId,
        campaignId: a.campaignId,
        callId: a.callId,
        agentId: a.agentId,
        detail: { awaiting: "agent-wrapup", talkSec: Math.round((Date.now() - (a.connectedAt || Date.now())) / 1000) },
      });
      return;
    }

    // Nobody talked to this customer — the engine finalises it right here so
    // the lead can never be left mid-flight.
    const campaign = await campaignConfig(a.campaignId).catch(() => null);
    const plan = await W.finalizeLead(db, {
      leadId: a.leadId,
      status,
      campaign,
      gatewayId: a.gatewayId,
    }).catch((e) => {
      log.error("finalize failed", e, { lead: a.leadId });
      return null;
    });

    await W.finishCallRecord(db, a.callId, {
      status,
      leadStatus: (plan && plan.status) || status,
      hangupCause: o.causeText || o.causeCode || null,
      employeeId: a.agentId,
    });

    if (a.agentId) {
      // The agent's leg was reserved but never bridged — free the seat.
      registry.setState(a.agentId, AGENT_STATE.READY, { reason: "call-not-connected" });
    }

    log.log(EVENT.FAILED, {
      leadId: a.leadId,
      campaignId: a.campaignId,
      listId: a.listId,
      callId: a.callId,
      gatewayId: a.gatewayId,
      to: (plan && plan.status) || status,
      detail: {
        cause: o.causeText || o.causeCode || "unknown",
        answered: answered ? 1 : 0,
        durationSec: Math.round((Date.now() - a.startedAt) / 1000),
      },
    });

    if (plan && plan.willRetry) {
      log.log(EVENT.RETRY_SCHEDULED, {
        leadId: a.leadId,
        campaignId: a.campaignId,
        listId: a.listId,
        to: plan.status,
        detail: { at: plan.nextRetryAt, delayMin: plan.delayMin, attempt: plan.callCount },
      });
    } else if (plan) {
      log.log(plan.exhausted ? EVENT.COMPLETED : EVENT.RELEASED, {
        leadId: a.leadId,
        campaignId: a.campaignId,
        to: plan.status,
        detail: { reason: plan.reason, attempts: plan.callCount },
      });
    }
  }

  /* ---------------- callbacks (scheduled calls) ---------------- */

  /**
   * Feed due callbacks into the dial queue: the lead's priority is raised and
   * its retry timer cleared, so the very next claim picks it first.
   */
  async function injectCallbacks() {
    try {
      const [due] = await db.query(
        `SELECT s.id, s.csv_data_id, s.campaign_id, s.assigned_to, s.callback_type,
                s.phone_number, s.scheduled_at
           FROM scheduled_calls s
          WHERE s.status = 'pending'
            AND s.scheduled_at <= DATE_ADD(NOW(), INTERVAL ? MINUTE)
          ORDER BY s.scheduled_at ASC
          LIMIT 50`,
        [cfg.callbackLookaheadMin],
      );
      if (!due.length) return;

      for (const cb of due) {
        // Resolve the lead: by id when the callback was booked from a lead,
        // else by phone number inside the campaign.
        let leadId = cb.csv_data_id || null;
        let campaignId = cb.campaign_id || null;
        if (!leadId) {
          const [rows] = await db.query(
            `SELECT id, campaign_id FROM csv_data
              WHERE phone_number = ? ${campaignId ? "AND campaign_id = ?" : ""}
              ORDER BY id DESC LIMIT 1`,
            campaignId ? [cb.phone_number, campaignId] : [cb.phone_number],
          );
          if (rows[0]) {
            leadId = rows[0].id;
            campaignId = rows[0].campaign_id;
          }
        }
        if (!leadId) {
          // Nothing to dial — close it so it does not sit pending forever.
          await db.query("UPDATE scheduled_calls SET status = 'missed' WHERE id = ?", [cb.id]);
          continue;
        }

        const campaign = campaignId ? await campaignConfig(campaignId) : null;
        if (campaign && Number(campaign.callbacks_enabled) === 0) continue;

        // Move the lead into the CALLBACK status: always dialable, top of the
        // queue, retry timer cleared. An agent callback keeps assigned_to set
        // so the engine can hand the answered call back to the same agent.
        const [res] = await db.query(
          `UPDATE csv_data
              SET call_status       = ?,
                  status_changed_at = NOW(),
                  called             = 0,
                  priority           = GREATEST(priority, 100),
                  next_retry_at      = NULL,
                  assigned_to        = ?,
                  claimed_at         = NULL,
                  pre_dial_status    = NULL
            WHERE id = ?
              AND call_status NOT IN (?, ?, ?, ?, ?, ?)`,
          [
            LEAD_STATUS.CALLBACK,
            cb.callback_type === "agent" ? cb.assigned_to ?? null : null,
            leadId,
            LEAD_STATUS.QUEUED,
            LEAD_STATUS.DIALING,
            LEAD_STATUS.RINGING,
            LEAD_STATUS.CONNECTED,
            LEAD_STATUS.WRONG_NUMBER,
            LEAD_STATUS.DNC,
          ],
        );
        if (res.affectedRows === 0) continue; // mid-call or permanently closed

        await db.query("UPDATE scheduled_calls SET status = 'done' WHERE id = ?", [cb.id]);

        log.log(EVENT.CALLBACK_QUEUED, {
          leadId,
          campaignId,
          agentId: cb.assigned_to,
          to: LEAD_STATUS.CALLBACK,
          detail: { type: cb.callback_type, dueAt: cb.scheduled_at },
        });
      }
    } catch (e) {
      log.error("callback injection failed", e);
    }
  }

  /* ---------------- self-healing ---------------- */

  let lastSweep = 0;
  async function sweep() {
    // Agent seats stuck because a browser event was lost.
    const recovered = registry.sweep({
      onCallTimeoutSec: cfg.onCallTimeoutSec,
      wrapupTimeoutSec: cfg.wrapupTimeoutSec,
    });
    for (const r of recovered) {
      log.warn("agent recovered", { agent: r.id, from: r.from, ageSec: r.ageSec });
    }

    // Attempts whose ARI events never arrived.
    const now = Date.now();
    for (const [id, a] of attempts) {
      const ageSec = (now - a.startedAt) / 1000;
      const limit =
        a.state === "connected" ? cfg.onCallTimeoutSec : cfg.ringingTimeoutSec + 30;
      if (ageSec > limit) {
        log.warn("attempt timed out", { attempt: id, lead: a.leadId, state: a.state, ageSec: Math.round(ageSec) });
        try {
          await ari.hangup(id);
        } catch {
          /* channel already gone */
        }
        await onEnded(id, { answered: Boolean(a.answeredAt), bridged: Boolean(a.connectedAt), causeText: "stale" });
      }
    }

    // Leads left mid-flight in the database (crash recovery). Run less often —
    // it is a table scan on an indexed column, not a per-tick concern.
    if (now - lastSweep > 15_000) {
      lastSweep = now;
      try {
        const res = await W.recoverStaleLeads(db, {
          claimTimeoutSec: cfg.claimTimeoutSec,
          ringingTimeoutSec: cfg.ringingTimeoutSec,
          onCallTimeoutSec: cfg.onCallTimeoutSec,
        });
        if (res.cancelled || res.failed) {
          log.warn("stale leads recovered", {
            reservationsRolledBack: res.cancelled,
            attemptsFinalised: res.failed,
          });
          for (const id of res.ids) {
            log.log(EVENT.RECOVERED, { leadId: id, detail: { reason: "stale-in-flight" } });
          }
        }
      } catch (e) {
        log.error("stale lead recovery failed", e);
      }

      // Expire cooldown entries so the maps cannot grow without bound.
      const cutoff = now - Math.max(cfg.phoneCooldownSec * 1000 * 4, 600_000);
      for (const [phone, at] of phoneCooldown) if (at < cutoff) phoneCooldown.delete(phone);
    }
  }

  /* ---------------- pacing ---------------- */

  /** Is the campaign inside its allowed calling window? */
  function insideCallingWindow(campaign) {
    const start = campaign.calling_start;
    const end = campaign.calling_end;
    if (!start || !end) return true;
    const d = new Date();
    const nowSec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    const toSec = (t) => {
      const [h, m, s] = String(t).split(":").map(Number);
      return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    };
    const a = toSec(start);
    const b = toSec(end);
    // A window that wraps past midnight (22:00 -> 06:00) is still one window.
    return a <= b ? nowSec >= a && nowSec <= b : nowSec >= a || nowSec <= b;
  }

  /**
   * READY agents the engine may pace against right now.
   *
   * campaigns.wrapup_seconds gives an agent a breather after a call: they are
   * READY (and will still take an answered call rather than let it abandon)
   * but the engine does not open a new line on their behalf until the breather
   * has passed. 0 = no breather, dial for them immediately.
   */
  function paceableAgents(campaign, ready) {
    const breatherMs = (Number(campaign.wrapup_seconds) || 0) * 1000;
    if (breatherMs <= 0) return ready;
    const now = Date.now();
    return ready.filter((a) => now - a.since >= breatherMs);
  }

  /**
   * Take a campaign's agents out of the pacing pool because the campaign is
   * not (or is no longer) one the server dials for.
   *
   * A READY agent means "the engine may open a line for me". On a manual or
   * inbound campaign that is a lie: nobody will ever dial for them and they
   * would sit there forever counting as capacity in the dashboard. Moving
   * them to PAUSE is the honest state, and the client is told why so the
   * Dialer can drop out of auto mode without a reload.
   *
   * Agents on a live call are left alone — a mode change must never cut off a
   * customer who is mid-conversation.
   */
  function releasePacingPool(campaignId, mode) {
    const ready = registry.readyFor(campaignId);
    if (ready.length === 0) return;
    for (const a of ready) {
      registry.setState(a.id, AGENT_STATE.PAUSE, { reason: "mode-not-engine-driven" });
      io.to("agent:" + a.id).emit("dialer-mode-changed", {
        campaignId,
        dialerType: mode,
        reason:
          `${labelFor(mode)} campaigns are dialled by the agent, so the ` +
          `auto-dialer has stopped opening lines for you.`,
      });
    }
    log.info("pacing pool released", {
      campaign: campaignId,
      mode,
      agents: ready.length,
      reason: "ModeNotEngineDriven",
    });
  }

  /**
   * Agents whose current call is expected to be over within `horizonSec`.
   *
   * This is the forecast at the heart of predictive dialing: a call dialled
   * now reaches a human in about one ring cycle, so the agents it should be
   * aimed at are the ones who will be free by then — not only the ones idle
   * this instant. An agent INCALL for `t` seconds is expected free in
   * `avgHandle - t`.
   *
   * WRAPUP seats count the same way: the wrap-up form is the tail of the
   * handle time, and an agent who is 90% through it will be ready long before
   * a call dialled now is answered.
   */
  function agentsFreeingWithin(campaignId, horizonSec) {
    const handle = avgHandleSec(campaignId);
    const now = Date.now();
    let n = 0;
    for (const a of registry.staffedFor(campaignId)) {
      if (a.agentState !== AGENT_STATE.INCALL && a.agentState !== AGENT_STATE.WRAPUP) continue;
      const busyFor = (now - a.since) / 1000;
      const remaining = handle - busyFor;
      // Already past the average: treat as freeing now, not as never freeing.
      if (remaining <= horizonSec) n++;
    }
    return n;
  }

  /**
   * PREDICTIVE pacing — the adaptive algorithm. Runs for `predictive`
   * campaigns and nothing else (asserted by the caller and again here).
   *
   * Every second:
   *
   *   1. forecast the agents free when a call dialled now would be answered
   *          expectedFree = ready + agents finishing within one ring cycle
   *   2. divide by the measured answer rate to get the lines that produces
   *          linesNeeded = expectedFree / answerRate
   *   3. hold it under the abandon budget — the governor below
   *   4. never exceed the campaign's dial_ratio, which is a CEILING here
   *   5. subtract the lines already in flight, then cap by gateway channels
   *
   * The abandon governor is proportional rather than a cliff: inside 75% of
   * the budget the forecast is used as-is, between 75% and 100% it is damped
   * linearly toward progressive, and over budget the campaign dials strictly
   * one line per ready agent until the rate recovers. That keeps a campaign
   * legal without the sawtooth of an on/off throttle.
   */
  async function predictiveCapacity(campaign, paceable) {
    const campaignId = campaign.id;
    if (!isPredictive(campaign.dialer_type)) {
      // Unreachable by design — the dispatcher below refuses first. Kept as a
      // hard stop so no future call path can slip adaptive pacing into a
      // ratio or manual campaign.
      return { slots: 0, reason: "NotPredictiveMode", ratio: 0 };
    }

    const readyCount = paceable.length;
    const ringSec = avgRingSec(campaignId);
    const freeingSoon = agentsFreeingWithin(campaignId, ringSec);
    const expectedFree = readyCount + freeingSoon;
    if (expectedFree <= 0) {
      return { slots: 0, reason: "NoReadyAgents", ratio: 0, ready: readyCount };
    }

    const rate = answerRate(campaignId);
    const abandoning = abandonPct(campaignId);

    // The forecast itself is pure arithmetic and lives in src/lib/pacing.js,
    // where it can be read and tested without a switch or a database.
    const { target, ratio, governor } = predictiveTarget({
      ready: readyCount,
      freeingSoon,
      answerRate: rate,
      ceiling: Number(campaign.dial_ratio) || cfg.ratio || 1,
      abandonPct: abandoning,
      maxAbandonPct: Number(campaign.max_abandon_pct) || cfg.maxAbandonPct,
    });

    const live = liveAttemptsFor(campaignId);
    let slots = target - live;
    const detail = {
      ratio: Number(ratio.toFixed(2)),
      live,
      target,
      ready: readyCount,
      freeingSoon,
      answerRate: Number(rate.toFixed(2)),
      ringSec: Math.round(ringSec),
      handleSec: Math.round(avgHandleSec(campaignId)),
      abandonPct: abandoning,
      governed: governor < 1,
    };
    if (slots <= 0) return { slots: 0, reason: "AtCapacity", ...detail };

    const gwFree = await gateways.capacityForCampaign(campaignId);
    if (gwFree === 0) return { slots: 0, reason: "NoGatewayChannels", ...detail };
    if (gwFree !== Infinity) slots = Math.min(slots, gwFree);

    return { slots, reason: null, ...detail };
  }

  /**
   * RATIO pacing — fixed, and deliberately blind.
   *
   * dial_ratio lines per READY agent, every tick, whatever the answer rate or
   * the handle time happen to be. No forecast is made and no statistic is
   * consulted: that is the difference between a ratio dialer and a predictive
   * one, and it is why the two are separate functions rather than one function
   * with a flag.
   *
   * The one thing that can hold it back is the global abandon cutoff, which is
   * a compliance stop rather than pacing: over the limit the campaign drops to
   * one line per agent until the rate recovers. It never raises the ratio and
   * never computes a new one.
   */
  async function ratioCapacity(campaign, paceable) {
    const campaignId = campaign.id;
    const readyCount = paceable.length;
    if (readyCount <= 0) return { slots: 0, reason: "NoReadyAgents", ratio: 0, ready: 0 };

    const abandoning = abandonPct(campaignId);
    // Compliance cutoff only — dropping calls without limit is not something a
    // campaign may configure its way out of.
    const overBudget = abandoning > cfg.maxAbandonPct;
    const { target, ratio } = ratioTarget({
      ready: readyCount,
      ratio: Number(campaign.dial_ratio) || cfg.ratio || 1,
      overBudget,
    });

    const live = liveAttemptsFor(campaignId);
    let slots = target - live;
    const detail = { ratio, live, target, ready: readyCount, abandonPct: abandoning, governed: overBudget };
    if (slots <= 0) return { slots: 0, reason: "AtCapacity", ...detail };

    const gwFree = await gateways.capacityForCampaign(campaignId);
    if (gwFree === 0) return { slots: 0, reason: "NoGatewayChannels", ...detail };
    if (gwFree !== Infinity) slots = Math.min(slots, gwFree);

    return { slots, reason: null, ...detail };
  }

  /**
   * How many new lines this campaign may open right now, chosen by MODE.
   * This is the only place either pacing model is entered.
   */
  async function capacityFor(campaign, paceable) {
    const mode = normalizeMode(campaign.dialer_type);
    if (!isEngineDriven(mode)) return { slots: 0, reason: "ModeNotEngineDriven", ratio: 0 };
    return isPredictive(mode)
      ? predictiveCapacity(campaign, paceable)
      : ratioCapacity(campaign, paceable);
  }

  /* ---------------- the loop ---------------- */

  let tickRunning = false;
  let lastCallbackPoll = 0;

  async function tick() {
    if (tickRunning) return;
    tickRunning = true;
    try {
      await sweep();

      if (!cfg.enabled) return;

      if (Date.now() - lastCallbackPoll > 10_000) {
        lastCallbackPoll = Date.now();
        await injectCallbacks();
      }

      const ariUp = !ari.isConnected || ari.isConnected();

      for (const campaignId of registry.activeCampaignIds()) {
        const counts = registry.countsFor(campaignId);
        const campaign = await campaignConfig(campaignId);
        if (!campaign) continue;

        // MODE GATE. Manual and inbound campaigns are agent-driven: the engine
        // never originates, never claims and never paces for them.
        //
        // Agents signed on to one are also taken out of the pacing pool here
        // rather than being left READY — that is what makes a mode change take
        // effect on the next tick instead of the next browser reload, and it
        // stops a campaign that was switched to Manual from still looking like
        // dialable capacity.
        if (!isEngineDriven(campaign.dialer_type)) {
          releasePacingPool(campaignId, campaign.dialer_type);
          continue;
        }
        if (campaign.status !== "active") {
          log.info("campaign skipped", { campaign: campaignId, reason: "CampaignNotActive" });
          continue;
        }
        if (!insideCallingWindow(campaign)) {
          log.info("campaign skipped", { campaign: campaignId, reason: "OutsideCallingWindow" });
          continue;
        }
        if (!ariUp) {
          log.info("campaign skipped", { campaign: campaignId, reason: "ARIDisconnected" });
          continue;
        }

        const paceable = paceableAgents(campaign, registry.readyFor(campaignId));
        const cap = await capacityFor(campaign, paceable);
        if (cap.ratio != null) {
          const s = statsFor(campaignId);
          s.lastRatio = cap.ratio;
          s.lastTarget = cap.target ?? null;
        }
        if (cap.slots <= 0) {
          if (counts.ready > 0 && cap.reason !== "AtCapacity") {
            log.info("no capacity", {
              campaign: campaignId,
              mode: campaign.dialer_type,
              reason: cap.reason,
              ready: counts.ready,
              paceable: paceable.length,
            });
          }
          continue;
        }

        const { leads, reason } = await claimLeads(campaign, cap.slots);
        if (leads.length === 0) {
          if (reason) log.info("nothing to dial", { campaign: campaignId, reason, ready: counts.ready });
          continue;
        }

        let placed = 0;
        for (const lead of leads) {
          const isCallback = normalizeStatus(lead.call_status) === LEAD_STATUS.CALLBACK;
          const okDial = await dialLead(campaign, lead, {
            // An agent callback carries the booking agent in assigned_to.
            preferredAgentId: isCallback ? lead.assigned_to || null : null,
            dialSource: isCallback
              ? "callback"
              : campaign.dialer_type === "ratio"
                ? "ratio"
                : "predictive",
          });
          if (okDial) placed++;
        }

        log.info("pacing", {
          campaign: campaignId,
          mode: campaign.dialer_type,
          ready: counts.ready,
          incall: counts.incall,
          wrapup: counts.wrapup,
          ratio: cap.ratio,
          target: cap.target,
          live: cap.live,
          dialed: placed,
          abandonPct: (cap.abandonPct || 0).toFixed(1),
          // Predictive-only forecast inputs; absent on a ratio campaign
          // because a ratio campaign never consults them.
          ...(isPredictive(campaign.dialer_type)
            ? {
                answerRate: cap.answerRate,
                freeingSoon: cap.freeingSoon,
                ringSec: cap.ringSec,
                handleSec: cap.handleSec,
                governed: cap.governed,
              }
            : {}),
        });
      }
    } catch (e) {
      // One failure must NEVER stop the scheduler.
      log.error("tick error (loop continues)", e);
    } finally {
      tickRunning = false;
    }
  }

  /* ---------------- startup ---------------- */

  let timer = null;
  let cfgTimer = null;

  async function boot() {
    await refreshConfig();
    // Clean up anything a previous process left behind before dialing again.
    try {
      const stale = await W.recoverStaleCallRecords(db, 3600);
      if (stale > 0) log.warn("stale call rows closed at startup", { rows: stale });
      const leads = await W.recoverStaleLeads(db, {
        claimTimeoutSec: cfg.claimTimeoutSec,
        ringingTimeoutSec: cfg.ringingTimeoutSec,
        onCallTimeoutSec: cfg.onCallTimeoutSec,
      });
      if (leads.cancelled || leads.failed) {
        log.warn("stale leads recovered at startup", {
          reservationsRolledBack: leads.cancelled,
          attemptsFinalised: leads.failed,
        });
      }
    } catch (e) {
      log.error("startup recovery failed", e);
    }
    gateways.start();
    timer = setInterval(() => {
      tick().catch((e) => log.error("tick rejected", e));
    }, cfg.tickMs);
    cfgTimer = setInterval(() => {
      refreshConfig().catch(() => {});
    }, 15_000);
    log.info("predictive engine started", {
      tickMs: cfg.tickMs,
      ratio: cfg.ratio,
      claimTimeoutSec: cfg.claimTimeoutSec,
    });
  }

  boot().catch((e) => log.error("engine boot failed", e));

  /* ---------------- public surface ---------------- */

  return {
    // ARI event handlers
    onRinging,
    onAnswered,
    onBridged,
    onEnded,

    /**
     * Called by the wrap-up API once an agent has dispositioned a call, so the
     * seat returns to READY the moment the form is saved.
     */
    agentWrapupDone(agentId) {
      const a = registry.get(agentId);
      if (a && a.agentState === AGENT_STATE.WRAPUP) {
        registry.setState(agentId, AGENT_STATE.READY, { reason: "wrapup-saved" });
      }
    },

    /** Force an immediate cycle and re-read the tunables. Never throws. */
    kick() {
      campaignCache.clear();
      gateways.invalidate();
      refreshConfig().catch(() => {});
      tick().catch((e) => log.error("kick tick rejected", e));
    },

    /**
     * The campaign's dialer mode, read fresh enough to enforce with.
     *
     * server.mjs asks before it puts an agent into the pacing pool, so an
     * agent can never register as dialable capacity on a manual or inbound
     * campaign — not even with a hand-crafted socket message.
     *
     * @returns {Promise<'predictive'|'ratio'|'manual'|'inbound'|null>}
     */
    async campaignMode(campaignId) {
      const id = Number(campaignId);
      if (!Number.isInteger(id) || id <= 0) return null;
      const c = await campaignConfig(id).catch(() => null);
      return c ? normalizeMode(c.dialer_type) : null;
    },

    /** Does the SERVER place calls for this campaign? @returns {Promise<boolean>} */
    async campaignIsEngineDriven(campaignId) {
      const mode = await this.campaignMode(campaignId);
      // Unknown campaign: refuse. Pacing for a campaign we cannot read the
      // mode of is exactly the situation this guard exists to prevent.
      return mode == null ? false : isEngineDriven(mode);
    },

    /** Everything the live dashboard needs, straight from memory. */
    snapshot() {
      const live = [];
      for (const a of attempts.values()) {
        live.push({
          attemptId: a.id,
          campaignId: a.campaignId,
          leadId: a.leadId,
          callId: a.callId,
          phone: a.phone,
          contactName: a.contactName,
          gatewayId: a.gatewayId,
          agentId: a.agentId,
          state: a.state,
          source: a.dialSource,
          ageSec: Math.round((Date.now() - a.startedAt) / 1000),
        });
      }
      const campaigns = [];
      for (const [campaignId, s] of pacingStats) {
        const cached = campaignCache.get(campaignId);
        const mode = cached && cached.row ? normalizeMode(cached.row.dialer_type) : null;
        campaigns.push({
          campaignId,
          mode,
          attempts: s.attempts,
          answered: s.answered,
          abandoned: s.abandoned,
          abandonPct: Number(abandonPct(campaignId).toFixed(2)),
          // The forecast inputs, so the live dashboard can show WHY the
          // engine is pacing the way it is. Only meaningful for predictive
          // campaigns; a ratio campaign never reads them.
          answerRate: mode === "predictive" ? Number(answerRate(campaignId).toFixed(2)) : null,
          avgRingSec: mode === "predictive" ? Math.round(avgRingSec(campaignId)) : null,
          avgHandleSec: mode === "predictive" ? Math.round(avgHandleSec(campaignId)) : null,
          // What the engine last decided to run at — for a predictive campaign
          // this is the computed figure, not campaigns.dial_ratio.
          pacedRatio: s.lastRatio,
          pacedTarget: s.lastTarget,
          live: liveAttemptsFor(campaignId),
          ...registry.countsFor(campaignId),
        });
      }
      return {
        enabled: cfg.enabled,
        ariConnected: !ari.isConnected || ari.isConnected(),
        tickMs: cfg.tickMs,
        calls: live,
        campaigns,
        gateways: gateways.snapshot(),
        agents: registry.snapshot(),
      };
    },

    stop() {
      if (timer) clearInterval(timer);
      if (cfgTimer) clearInterval(cfgTimer);
      timer = null;
      cfgTimer = null;
      gateways.stop();
    },
  };
};

/* =====================================================================
 *  predictive-engine.js  —  Phase 1 (agent-decoupled power dialer)
 *
 *  Server HI calls originate karta hai (ARI ke through). Agent ko
 *  dialing / ringing kuch nahi dikhti — sirf CONNECTED call uske
 *  screen pe pop hoti hai.
 *
 *  RELIABILITY / SAFETY (this revision):
 *   - Reservations carry a TTL and self-heal (no permanent agent stalls).
 *   - Per-phone in-flight lock  -> a customer never gets two calls at once.
 *   - Per-phone cooldown        -> no immediate re-dial of the same number.
 *   - Capacity = availableAgents * predictive_ratio (configurable).
 *   - Tick loop is overlap-guarded and survives any per-call error.
 *   - Skips ARI originating while ARI is down, then resumes automatically.
 *   - Structured [PREDICTIVE] diagnostics — every skip logs a reason.
 *
 *  All tunables live in the existing `settings` table (no schema change):
 *   - predictive_ratio            (default 1)
 *   - phone_cooldown_seconds      (default 60)
 *   - dialer_claim_timeout_sec    (default 120)
 *   - dialer_oncall_timeout_sec   (default 1800)  // stuck on-call recovery
 *
 *  Phase 2 TODO: RATIO > 1 over-dial, AMD, abandon-rate cap.
 * ===================================================================== */
"use strict";

const mysql = require("mysql2/promise");

/**
 * @param io     Socket.IO server (server.mjs se)
 * @param agents Map<userId, {id,name,role,state,available,extension,campaignId}>
 * @param ari    startAri() ka return: { originatePredictive, setHandlers, isConnected }
 */
module.exports = function startPredictiveEngine({ io, agents, ari }) {
  const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });
  console.log("[engine] predictive engine started");

  const TICK_MS = 1500;

  // ---- tunables (refreshed from the settings table) ----
  const cfg = {
    ratio: 1,
    phoneCooldownSec: 60,
    claimTimeoutSec: 120,
    onCallTimeoutSec: 1800,
  };
  const numOr = (v, d) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  async function refreshConfig() {
    try {
      const [rows] = await db.query(
        `SELECT setting_key, setting_value FROM settings
          WHERE setting_key IN (?,?,?,?)`,
        [
          "predictive_ratio",
          "phone_cooldown_seconds",
          "dialer_claim_timeout_sec",
          "dialer_oncall_timeout_sec",
        ],
      );
      const m = {};
      for (const r of rows) m[r.setting_key] = r.setting_value;
      cfg.ratio = Math.max(1, numOr(m.predictive_ratio, 1));
      cfg.phoneCooldownSec = numOr(m.phone_cooldown_seconds, 60);
      cfg.claimTimeoutSec = Math.max(30, numOr(m.dialer_claim_timeout_sec, 120));
      cfg.onCallTimeoutSec = Math.max(120, numOr(m.dialer_oncall_timeout_sec, 1800));
    } catch (e) {
      console.error("[engine] config refresh failed:", e && e.message);
    }
  }

  // ---- in-memory state ----
  // agentId -> { at, phone, csvId, campaignId }  (an ORIGINATING/ringing attempt)
  const reservations = new Map();
  // agentId -> phone  (a CONNECTED, live call — phone stays locked until it ends)
  const connectedPhones = new Map();
  // phone -> { agentId, kind: 'originating'|'connected', at }
  const inFlightPhones = new Map();
  // phone -> epoch ms when the last attempt to that number finished (cooldown)
  const lastDialedAtByPhone = new Map();
  // agentId -> epoch ms when marked on-call (for stuck-agent recovery)
  const onCallSince = new Map();

  const normPhone = (p) => String(p || "").replace(/[^\d+]/g, "");

  // Reserve an agent + lock the phone while the GSM leg is originating/ringing.
  function reserve(agent, contact) {
    const phone = normPhone(contact.phone_number);
    reservations.set(agent.id, {
      at: Date.now(),
      phone,
      csvId: contact.id,
      campaignId: agent.campaignId,
    });
    if (phone) inFlightPhones.set(phone, { agentId: agent.id, kind: "originating", at: Date.now() });
  }

  // Release an originating reservation (originate-failed / no-answer / timeout).
  // Starts the phone cooldown from "now" (the attempt has finished).
  function releaseReservation(agentId, reason) {
    const r = reservations.get(agentId);
    if (!r) return;
    reservations.delete(agentId);
    if (r.phone) {
      const f = inFlightPhones.get(r.phone);
      if (f && f.agentId === agentId && f.kind === "originating") inFlightPhones.delete(r.phone);
      lastDialedAtByPhone.set(r.phone, Date.now());
    }
    if (reason) {
      console.log(
        `[PREDICTIVE] ReservationReleased agent=${agentId} csv=${r.csvId} phone=${r.phone} reason=${reason}`,
      );
    }
  }

  // Release a connected (live) call's phone lock when the call has ended.
  function releaseConnected(agentId, reason) {
    const phone = connectedPhones.get(agentId);
    if (phone) {
      const f = inFlightPhones.get(phone);
      if (f && f.agentId === agentId) inFlightPhones.delete(phone);
      lastDialedAtByPhone.set(phone, Date.now());
      connectedPhones.delete(agentId);
      if (reason) {
        console.log(`[PREDICTIVE] ConnectedReleased agent=${agentId} phone=${phone} reason=${reason}`);
      }
    }
    onCallSince.delete(agentId);
  }

  // ---- DB helpers ----

  // is campaign ka pehla active gateway (validated: active + has endpoint)
  async function gatewayForCampaign(campaignId) {
    const [rows] = await db.query(
      `SELECT g.id, g.name, g.asterisk_endpoint AS endpoint
         FROM campaign_gateways cg
         JOIN gsm_gateways g ON g.id = cg.gateway_id
        WHERE cg.campaign_id = ? AND g.status = 'active'
          AND g.asterisk_endpoint IS NOT NULL AND g.asterisk_endpoint <> ''
        LIMIT 1`,
      [campaignId],
    );
    return rows[0] || null;
  }

  // agla un-called contact claim karo (FIFO + lock). Claim timeout is
  // configurable; an unfinished claim is re-offered after claimTimeoutSec.
  async function claimNextContact(campaignId, agentId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute(
        `SELECT id, phone_number, name, email, company, custom_fields
           FROM csv_data
          WHERE campaign_id = ? AND called = 0
            AND (claimed_at IS NULL
                 OR claimed_at < DATE_SUB(NOW(), INTERVAL ? SECOND))
          ORDER BY id ASC
          LIMIT 1
          FOR UPDATE`,
        [campaignId, cfg.claimTimeoutSec],
      );
      const c = rows[0];
      if (!c) {
        await conn.commit();
        return null;
      }
      await conn.execute(
        "UPDATE csv_data SET claimed_at = NOW(), assigned_to = ? WHERE id = ?",
        [agentId, c.id],
      );
      await conn.commit();
      return c;
    } catch (e) {
      try { await conn.rollback(); } catch (_) { /* ignore */ }
      console.error("[engine] claim failed:", e && e.message);
      return null;
    } finally {
      conn.release();
    }
  }

  function activeCallsForCampaign(campaignId) {
    let n = 0;
    for (const r of reservations.values()) if (r.campaignId === campaignId) n++;
    for (const agentId of connectedPhones.keys()) {
      const a = agents.get(agentId);
      if (a && a.campaignId === campaignId) n++;
    }
    return n;
  }

  // ---- one originate for one free agent ----
  async function dialForAgent(agent) {
    // Resolve gateway from the campaign (never hardcoded / env).
    let gw;
    try {
      gw = await gatewayForCampaign(agent.campaignId);
    } catch (e) {
      // Transient DB/network error — this is NOT a missing gateway. Log it
      // accurately and skip this tick; the loop keeps running and retries.
      console.log(
        `[PREDICTIVE] Campaign=${agent.campaignId} agent=${agent.id} ` +
          `Reason=GatewayLookupError (${e && e.message})`,
      );
      return false;
    }
    if (!gw) {
      console.log(`[PREDICTIVE] Campaign=${agent.campaignId} agent=${agent.id} Reason=GatewayMissing`);
      return false;
    }

    const contact = await claimNextContact(agent.campaignId, agent.id);
    if (!contact) {
      console.log(`[PREDICTIVE] Campaign=${agent.campaignId} agent=${agent.id} Reason=NoContacts`);
      return false;
    }

    const phone = normPhone(contact.phone_number);

    // Rule 3: the same customer number must never get concurrent calls.
    // (Duplicate phones across loan accounts are valid data — we lock by the
    //  number that is actually on a line right now, not by loan account.)
    if (phone && inFlightPhones.has(phone)) {
      console.log(
        `[PREDICTIVE] csv=${contact.id} phone=${phone} Reason=DuplicatePhoneInFlight ` +
          `(leaving claim; retries after ${cfg.claimTimeoutSec}s)`,
      );
      return false; // keep the claim parked so the engine moves to other contacts
    }

    // Rule 4: per-phone cooldown after a finished attempt.
    const last = lastDialedAtByPhone.get(phone);
    if (phone && last && Date.now() - last < cfg.phoneCooldownSec * 1000) {
      const waitMs = cfg.phoneCooldownSec * 1000 - (Date.now() - last);
      console.log(
        `[PREDICTIVE] csv=${contact.id} phone=${phone} Reason=PhoneCooldown ` +
          `(${Math.ceil(waitMs / 1000)}s left)`,
      );
      return false; // keep the claim parked; eligible again after claim timeout
    }

    // Reserve agent + lock phone, then originate.
    reserve(agent, contact);
    try {
      await ari.originatePredictive({
        campaignId: agent.campaignId,
        agentId: agent.id,
        agentExt: agent.extension,
        contact,
        gateway: gw.endpoint,
      });
      console.log(
        `[PREDICTIVE] Dialing agent=${agent.id} ext=${agent.extension} csv=${contact.id} ` +
          `phone=${phone} gw=${gw.name}(${gw.endpoint})`,
      );
      return true;
      // aage ari-app handle karega: answer -> onConnect, fail/end -> onFailed
    } catch (e) {
      console.error(
        `[PREDICTIVE] OriginateFailed agent=${agent.id} csv=${contact.id}: ${e && e.message}`,
      );
      releaseReservation(agent.id, "originate-failed");
      return false;
    }
  }

  // ---- self-healing: drop stale reservations / orphaned phone locks ----
  function sweep() {
    const now = Date.now();
    // Reservations that never got an ARI answer/fail callback.
    for (const [agentId, r] of reservations) {
      if (!agents.has(agentId) || now - r.at > cfg.claimTimeoutSec * 1000) {
        console.warn(
          `[PREDICTIVE] SelfHeal reservation agent=${agentId} csv=${r.csvId} ` +
            `(agentGone=${!agents.has(agentId)})`,
        );
        releaseReservation(agentId, "reservation-timeout");
      }
    }
    // Connected calls whose agent has gone away entirely.
    for (const agentId of [...connectedPhones.keys()]) {
      if (!agents.has(agentId)) {
        releaseConnected(agentId, "agent-disconnected");
      }
    }
  }

  // ---- stuck on-call recovery (browser missed the "idle" event) ----
  function recoverOnCall(agent) {
    const since = onCallSince.get(agent.id);
    if (!since) {
      onCallSince.set(agent.id, Date.now());
      return;
    }
    if (Date.now() - since > cfg.onCallTimeoutSec * 1000) {
      console.warn(
        `[PREDICTIVE] Agent ${agent.id} (ext ${agent.extension}) not marked available ` +
          `after call completion (>${cfg.onCallTimeoutSec}s) — recovering to idle`,
      );
      agent.state = "idle";
      releaseConnected(agent.id, "oncall-timeout");
    }
  }

  // ---- main pacing loop ----
  let tickRunning = false;
  async function tick() {
    if (tickRunning) return; // never overlap ticks
    tickRunning = true;
    try {
      sweep();

      // If ARI is down, do not originate — but keep the loop alive.
      const ariUp = !ari.isConnected || ari.isConnected();

      // Detect connected calls that have ended (agent went back to idle) and
      // free the phone lock + start its cooldown.
      for (const agent of agents.values()) {
        if (agent.role !== "employee") continue;
        if (connectedPhones.has(agent.id) && agent.state !== "on-call") {
          releaseConnected(agent.id, "call-ended");
        }
        if (agent.state !== "on-call") onCallSince.delete(agent.id);
      }

      // Group working agents per campaign for capacity + diagnostics.
      const working = new Map(); // campaignId -> { all:[], idle:[] }
      for (const agent of agents.values()) {
        if (agent.role !== "employee") continue;
        if (!agent.available) continue; // on break / logged off
        if (!agent.campaignId || !agent.extension) continue;
        if (!working.has(agent.campaignId)) working.set(agent.campaignId, { all: [], idle: [] });
        const bucket = working.get(agent.campaignId);
        bucket.all.push(agent);
        if (agent.state === "on-call") {
          recoverOnCall(agent);
        } else if (!reservations.has(agent.id)) {
          bucket.idle.push(agent);
        }
      }

      for (const [campaignId, bucket] of working) {
        const availableAgents = bucket.all.length;
        const activeCalls = activeCallsForCampaign(campaignId);
        const capacity = Math.floor(availableAgents * cfg.ratio);
        let slots = capacity - activeCalls;
        let dialingNow = 0;

        if (!ariUp) {
          console.log(`[PREDICTIVE] Campaign=${campaignId} Reason=ARIDisconnected (paused)`);
          continue;
        }

        for (const agent of bucket.idle) {
          if (slots <= 0) break;
          const placed = await dialForAgent(agent);
          if (placed) {
            dialingNow++;
            slots--;
          }
        }

        console.log(
          `[PREDICTIVE] Campaign=${campaignId} AvailableAgents=${availableAgents} ` +
            `Ratio=${cfg.ratio} Capacity=${capacity} ActiveCalls=${activeCalls} ` +
            `DialingNow=${dialingNow}`,
        );
      }
    } catch (e) {
      // One failure must NEVER stop the scheduler.
      console.error("[engine] tick error (loop continues):", e && e.message);
    } finally {
      tickRunning = false;
    }
  }

  // Prime config, then start the loops.
  refreshConfig();
  const cfgTimer = setInterval(() => {
    refreshConfig().catch(() => {});
  }, 15000);
  const timer = setInterval(() => {
    tick().catch((e) => console.error("[engine] tick rejected:", e && e.message));
  }, TICK_MS);

  // ---- ari-app in dono ko call karega ----

  // Human ne uthaya + agent leg bridge ho gaya -> screen pop.
  // Phone stays locked (connected) until the call actually ends.
  function onConnect(agentId, contact) {
    const r = reservations.get(agentId);
    const phone = r ? r.phone : normPhone(contact && contact.phone_number);
    reservations.delete(agentId);
    if (phone) {
      inFlightPhones.set(phone, { agentId, kind: "connected", at: Date.now() });
      connectedPhones.set(agentId, phone);
    }
    const a = agents.get(agentId);
    if (a) a.state = "on-call";
    onCallSince.set(agentId, Date.now());
    io.to("agent:" + agentId).emit("assigned-call", contact);
  }

  // No answer / busy / ended-before-connect -> release reservation, start cooldown.
  function onFailed(agentId /*, contact, cause */) {
    releaseReservation(agentId, "failed/no-answer");
  }

  return {
    onConnect,
    onFailed,
    stop: () => {
      clearInterval(timer);
      clearInterval(cfgTimer);
    },
  };
};

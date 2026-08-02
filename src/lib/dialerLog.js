/* =====================================================================
 *  dialerLog.js — structured, per-contact dialer logging.
 *
 *  Every lead that passes through the dialer leaves a readable trail in two
 *  places: the process log (one grep-able line per event) and the dialer_log
 *  table (queryable per contact / campaign, powering the contact report).
 *
 *  Writes are fire-and-forget: a logging failure must never break a call.
 *  CommonJS so the engine, the ARI app and the API routes all share it.
 * ===================================================================== */
"use strict";

/** The vocabulary of lifecycle events — requirement: log every stage. */
const EVENT = Object.freeze({
  SELECTED: "selected", // claim query returned this lead
  RESERVED: "reserved", // claim written (assigned_to + claimed_at)
  DIAL_STARTED: "dial_started", // originate accepted by Asterisk
  GATEWAY_USED: "gateway_used", // which trunk carried the attempt
  RINGING: "ringing",
  ANSWERED: "answered", // customer picked up
  CONNECTED: "connected", // bridged to an agent
  ABANDONED: "abandoned", // answered but no agent was free
  FAILED: "failed", // busy / no answer / congestion / originate error
  RETRY_SCHEDULED: "retry_scheduled",
  RETRY_ATTEMPT: "retry_attempt", // this dial came from the recycle branch
  DISPOSITION: "disposition", // agent saved the wrap-up
  COMPLETED: "completed", // lead reached a terminal status
  RELEASED: "released", // claim handed back
  RECOVERED: "recovered", // stale in-flight lead repaired by the sweeper
  CALLBACK_QUEUED: "callback_queued",
  GATEWAY_DOWN: "gateway_down",
  GATEWAY_UP: "gateway_up",
  PACING: "pacing",
});

function fmtValue(v) {
  if (v === null || v === undefined) return "-";
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/**
 * @param {{query: Function}} db  a mysql2 pool / connection (anything with .query)
 * @param {{tag?: string, toConsole?: boolean, toDb?: boolean}} [opts]
 */
function createDialerLog(db, opts) {
  const tag = (opts && opts.tag) || "DIALER";
  const toConsole = !opts || opts.toConsole !== false;
  const toDb = !opts || opts.toDb !== false;
  let dbBroken = false; // stop hammering a missing table on every event

  /**
   * Record one lifecycle event.
   * @param {string} event  one of EVENT
   * @param {object} ctx
   * @param {number|null} [ctx.leadId]
   * @param {number|null} [ctx.campaignId]
   * @param {number|null} [ctx.listId]
   * @param {number|null} [ctx.callId]
   * @param {number|null} [ctx.agentId]
   * @param {number|null} [ctx.gatewayId]
   * @param {string|null} [ctx.from]    status before
   * @param {string|null} [ctx.to]      status after
   * @param {object|null} [ctx.detail]  anything else worth keeping (JSON column)
   */
  function log(event, ctx) {
    const c = ctx || {};
    if (toConsole) {
      const parts = [`[${tag}]`, `event=${event}`];
      if (c.leadId != null) parts.push(`lead=${fmtValue(c.leadId)}`);
      if (c.campaignId != null) parts.push(`campaign=${fmtValue(c.campaignId)}`);
      if (c.listId != null) parts.push(`list=${fmtValue(c.listId)}`);
      if (c.agentId != null) parts.push(`agent=${fmtValue(c.agentId)}`);
      if (c.gatewayId != null) parts.push(`gw=${fmtValue(c.gatewayId)}`);
      if (c.callId != null) parts.push(`call=${fmtValue(c.callId)}`);
      if (c.from || c.to) parts.push(`status=${fmtValue(c.from)}->${fmtValue(c.to)}`);
      if (c.detail && typeof c.detail === "object") {
        for (const [k, v] of Object.entries(c.detail)) {
          if (v === undefined) continue;
          parts.push(`${k}=${fmtValue(v)}`);
        }
      }
      console.log(parts.join(" "));
    }

    if (!toDb || dbBroken || !db || typeof db.query !== "function") return;
    Promise.resolve(
      db.query(
        `INSERT INTO dialer_log
           (csv_data_id, campaign_id, list_id, call_id, agent_id, gateway_id,
            event, status_from, status_to, detail)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          c.leadId ?? null,
          c.campaignId ?? null,
          c.listId ?? null,
          c.callId ?? null,
          c.agentId ?? null,
          c.gatewayId ?? null,
          String(event).slice(0, 40),
          c.from ? String(c.from).slice(0, 32) : null,
          c.to ? String(c.to).slice(0, 32) : null,
          c.detail ? JSON.stringify(c.detail) : null,
        ],
      ),
    ).catch((e) => {
      if (e && (e.code === "ER_NO_SUCH_TABLE" || e.code === "ER_BAD_FIELD_ERROR")) {
        dbBroken = true;
        console.error(
          `[${tag}] dialer_log unavailable (${e.code}) — run "npm run db:migrate:vicidial". ` +
            "Console logging continues.",
        );
        return;
      }
      console.error(`[${tag}] dialer_log write failed:`, e && e.message);
    });
  }

  /** Non-lead diagnostics (pacing, gateway health) — console only by default. */
  function info(message, fields) {
    if (!toConsole) return;
    const parts = [`[${tag}]`, message];
    if (fields && typeof fields === "object") {
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) continue;
        parts.push(`${k}=${fmtValue(v)}`);
      }
    }
    console.log(parts.join(" "));
  }

  function warn(message, fields) {
    const parts = [`[${tag}]`, "WARN", message];
    if (fields && typeof fields === "object") {
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) continue;
        parts.push(`${k}=${fmtValue(v)}`);
      }
    }
    console.warn(parts.join(" "));
  }

  function error(message, err, fields) {
    const parts = [`[${tag}]`, "ERROR", message];
    if (fields && typeof fields === "object") {
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) continue;
        parts.push(`${k}=${fmtValue(v)}`);
      }
    }
    if (err) parts.push(`err="${(err && err.message) || err}"`);
    console.error(parts.join(" "));
  }

  return { log, info, warn, error, EVENT };
}

module.exports = { createDialerLog, EVENT };

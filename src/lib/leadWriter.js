/* =====================================================================
 *  leadWriter.js — the ONLY place csv_data lifecycle columns are written,
 *  plus the matching call-history (calls) row for every attempt.
 *
 *  Anything that dials — the predictive engine, the ARI app, the manual
 *  dialer API and the wrap-up API — goes through these functions, so the
 *  eight lifecycle columns can never drift apart:
 *
 *      call_status · called · call_count · last_call_at
 *      recycle_attempts · next_retry_at · assigned_to · claimed_at
 *
 *  CommonJS so the CJS engine/ARI app and the TypeScript API routes share it.
 * ===================================================================== */
"use strict";

const {
  LEAD_STATUS,
  IN_FLIGHT_STATUSES,
  TERMINAL_STATUSES,
  normalizeStatus,
  statusToCallStatus,
  planNextAttempt,
  parseRecycleRules,
  toSqlDateTime,
} = require("./leadStatus.js");

/** Run a statement on a pool or a connection, preferring prepared statements. */
async function run(db, sql, params) {
  if (typeof db.execute === "function") {
    try {
      return await db.execute(sql, params);
    } catch (e) {
      // Some statements (dynamic IN-lists over the placeholder limit) are
      // rejected by the binary protocol — fall back to the text protocol,
      // which is still fully parameterised.
      if (e && e.code === "ER_UNSUPPORTED_PS") return await db.query(sql, params);
      throw e;
    }
  }
  return await db.query(sql, params);
}

async function selectOne(db, sql, params) {
  const [rows] = await run(db, sql, params);
  return rows && rows[0] ? rows[0] : null;
}

/* ------------------------------------------------------------------ *
 *  1. RESERVE  —  NEW/…  ->  QUEUED
 * ------------------------------------------------------------------ */

/**
 * Write the claim for a lead the claim SELECT just locked. MUST run inside the
 * same transaction as that SELECT (the row is held by FOR UPDATE).
 *
 * Records the current status in pre_dial_status so an abandoned reservation
 * can be rolled back exactly, and so the recycle counter can later tell
 * whether the outcome status actually CHANGED.
 *
 * @param {*} conn   the transaction connection
 * @param {object} o
 * @param {number} o.leadId
 * @param {number|null} o.agentId  agent the lead is reserved for (null = engine pool)
 * @param {string} o.currentStatus the status the claim SELECT returned
 */
async function reserveLead(conn, { leadId, agentId, currentStatus }) {
  const prev = normalizeStatus(currentStatus);
  await run(
    conn,
    `UPDATE csv_data
        SET pre_dial_status   = ?,
            call_status       = ?,
            status_changed_at = NOW(),
            assigned_to       = ?,
            claimed_at        = NOW()
      WHERE id = ?`,
    [prev, LEAD_STATUS.QUEUED, agentId ?? null, leadId],
  );
  return prev;
}

/* ------------------------------------------------------------------ *
 *  2. DIAL  —  QUEUED  ->  DIALING   (requirement: "call started")
 * ------------------------------------------------------------------ */

/**
 * Stamp the dial attempt. This is the write that guarantees a lead can never
 * stay NEW after being dialled.
 *
 * @returns {Promise<{attemptNo:number, preDialStatus:string}>}
 */
async function markDialing(db, { leadId, gatewayId, viaRecycle, agentId }) {
  await run(
    db,
    `UPDATE csv_data
        SET recycle_attempts  = recycle_attempts + ?,
            call_status       = ?,
            status_changed_at = NOW(),
            called            = 1,
            call_count        = call_count + 1,
            last_call_at      = NOW(),
            last_gateway_id   = COALESCE(?, last_gateway_id),
            next_retry_at     = NULL,
            assigned_to       = COALESCE(?, assigned_to),
            claimed_at        = NOW()
      WHERE id = ?`,
    [viaRecycle ? 1 : 0, LEAD_STATUS.DIALING, gatewayId ?? null, agentId ?? null, leadId],
  );
  const row = await selectOne(
    db,
    "SELECT call_count, pre_dial_status FROM csv_data WHERE id = ?",
    [leadId],
  );
  return {
    attemptNo: Number(row && row.call_count) || 1,
    preDialStatus: (row && row.pre_dial_status) || LEAD_STATUS.NEW,
  };
}

/** DIALING -> RINGING. Refreshes the claim so a long ring cannot expire it. */
async function markRinging(db, leadId) {
  await run(
    db,
    `UPDATE csv_data
        SET call_status = ?, status_changed_at = NOW(), claimed_at = NOW()
      WHERE id = ? AND call_status = ?`,
    [LEAD_STATUS.RINGING, leadId, LEAD_STATUS.DIALING],
  );
}

/** RINGING -> CONNECTED (customer answered and an agent is bridged in). */
async function markConnected(db, { leadId, agentId }) {
  await run(
    db,
    `UPDATE csv_data
        SET call_status = ?, status_changed_at = NOW(),
            assigned_to = COALESCE(?, assigned_to), claimed_at = NOW()
      WHERE id = ?`,
    [LEAD_STATUS.CONNECTED, agentId ?? null, leadId],
  );
}

/** Keep a long live call's claim fresh so the sweeper never steals it. */
async function touchClaim(db, leadId) {
  await run(db, "UPDATE csv_data SET claimed_at = NOW() WHERE id = ?", [leadId]);
}

/* ------------------------------------------------------------------ *
 *  3. FINALISE  —  in-flight  ->  terminal / retry-scheduled
 * ------------------------------------------------------------------ */

/**
 * Land a finished attempt on a real status and schedule the redial if the
 * campaign's rules allow one. This is the single authority for the redial
 * queue: it reads the lead, applies the rules, and writes the result.
 *
 * @param {*} db
 * @param {object} o
 * @param {number} o.leadId
 * @param {string} o.status                 status the attempt produced
 * @param {string} [o.disposition]          agent disposition code (PTP, PAID…)
 * @param {object} [o.dispositionRule]      from resolveDisposition(); decides the
 *                                          lead's future when the agent saved one
 * @param {Date|string} [o.followUpAt]      callback time the agent booked
 * @param {object} [o.campaign]             {recycle_rules, retry_count, retry_delay_minutes}
 * @param {boolean} [o.release=true]        hand the claim back
 * @param {number} [o.gatewayId]
 * @returns {Promise<{status:string, willRetry:boolean, nextRetryAt:Date|null,
 *                    delayMin:number|null, reason:string, exhausted:boolean,
 *                    previousStatus:string, preDialStatus:string,
 *                    campaignId:number|null, listId:number|null,
 *                    callCount:number, recycleAttempts:number}|null>}
 */
async function finalizeLead(
  db,
  { leadId, status, disposition, dispositionRule, followUpAt, campaign, release, gatewayId },
) {
  const lead = await selectOne(
    db,
    `SELECT id, campaign_id, list_id, call_status, pre_dial_status, call_count,
            recycle_attempts, last_disposition
       FROM csv_data WHERE id = ?`,
    [leadId],
  );
  if (!lead) return null;

  let camp = campaign;
  if (!camp) {
    camp = await selectOne(
      db,
      "SELECT recycle_rules, retry_count, retry_delay_minutes FROM campaigns WHERE id = ?",
      [lead.campaign_id],
    );
  }

  // The disposition rule may land the lead on a different status than the line
  // produced (a BPTP call was CONNECTED but rests on CONNECTED with its own
  // retry timer; a "Number busy" TNC rests on BUSY). planNextAttempt applies
  // that; the recycle-budget comparison below has to use the same status.
  const newStatus = normalizeStatus(
    dispositionRule && dispositionRule.status ? dispositionRule.status : status,
  );
  // recycle_attempts is reset whenever the status CHANGES (VICIdial behaviour),
  // so the retry budget must be judged against the same comparison. The status
  // to compare against is the one the lead held BEFORE this attempt, captured
  // by reserveLead in pre_dial_status.
  //
  // A NULL pre_dial_status means we cannot prove the status changed (a lead
  // finalised twice, or one dialled outside the normal reserve path). Keeping
  // the counter is the safe reading: resetting it there would hand the lead a
  // fresh retry budget on every pass and it would never stop being dialled.
  const preDialRaw = lead.pre_dial_status;
  const hasPreDial = preDialRaw != null && String(preDialRaw).trim() !== '';
  const preDial = hasPreDial ? normalizeStatus(preDialRaw) : null;
  const effectiveAttempts =
    preDial === null || preDial === newStatus ? Number(lead.recycle_attempts) || 0 : 0;

  const plan = planNextAttempt({
    status: newStatus,
    recycleRules: parseRecycleRules(
      camp && camp.recycle_rules,
      camp && camp.retry_delay_minutes,
    ),
    recycleAttempts: effectiveAttempts,
    callCount: Number(lead.call_count) || 0,
    maxAttempts: camp ? Number(camp.retry_count) || 0 : 0,
    dispositionRule: dispositionRule || null,
    followUpAt: followUpAt || null,
  });

  const finalStatus = plan.status;
  const isTerminalNow = TERMINAL_STATUSES.includes(finalStatus);
  const releaseClaim = release !== false;

  await run(
    db,
    `UPDATE csv_data
        SET recycle_attempts  = IF(pre_dial_status IS NULL OR pre_dial_status = ?,
                                   recycle_attempts, 0),
            call_status       = ?,
            status_changed_at = NOW(),
            called            = 1,
            next_retry_at     = ?,
            last_disposition  = COALESCE(?, last_disposition),
            last_gateway_id   = COALESCE(?, last_gateway_id),
            completed_at      = ${isTerminalNow ? "COALESCE(completed_at, NOW())" : "completed_at"},
            pre_dial_status   = NULL,
            assigned_to       = ${releaseClaim ? "NULL" : "assigned_to"},
            claimed_at        = ${releaseClaim ? "NULL" : "claimed_at"}
      WHERE id = ?`,
    [
      finalStatus,
      finalStatus,
      plan.nextRetryAt ? toSqlDateTime(plan.nextRetryAt) : null,
      disposition ? String(disposition).slice(0, 32) : null,
      gatewayId ?? null,
      leadId,
    ],
  );

  return {
    ...plan,
    status: finalStatus,
    previousStatus: normalizeStatus(lead.call_status),
    preDialStatus: preDial,
    campaignId: lead.campaign_id,
    listId: lead.list_id,
    callCount: Number(lead.call_count) || 0,
    recycleAttempts: effectiveAttempts,
  };
}

/** Hand a claim back without changing the status (agent switched campaign…). */
async function releaseClaim(db, leadId) {
  await run(db, "UPDATE csv_data SET assigned_to = NULL, claimed_at = NULL WHERE id = ?", [leadId]);
}

/**
 * Roll a reservation back: a lead that was QUEUED but never dialled returns to
 * exactly the status it held before, so an agent who closes the tab costs the
 * lead nothing.
 */
async function cancelReservation(db, leadId) {
  await run(
    db,
    `UPDATE csv_data
        SET call_status       = COALESCE(pre_dial_status, ?),
            status_changed_at = NOW(),
            pre_dial_status   = NULL,
            assigned_to       = NULL,
            claimed_at        = NULL
      WHERE id = ? AND call_status = ?`,
    [LEAD_STATUS.NEW, leadId, LEAD_STATUS.QUEUED],
  );
}

/* ------------------------------------------------------------------ *
 *  4. RECOVERY  —  self-healing for crashes and dropped events
 * ------------------------------------------------------------------ */

/**
 * Repair leads left mid-flight by a crash, a killed process or a lost ARI
 * event. Without this, a lead stuck on DIALING would never be dialable again.
 *
 *  - QUEUED past the claim timeout        -> rolled back to pre_dial_status
 *  - DIALING/RINGING past the ring timeout -> FAILED + retry per the rules
 *  - CONNECTED past the on-call timeout    -> CANCELLED + retry per the rules
 *
 * @returns {Promise<{cancelled:number, failed:number, ids:number[]}>}
 */
async function recoverStaleLeads(db, { claimTimeoutSec, ringingTimeoutSec, onCallTimeoutSec }) {
  const claimSec = Math.max(30, Number(claimTimeoutSec) || 120);
  const ringSec = Math.max(30, Number(ringingTimeoutSec) || 90);
  const callSec = Math.max(120, Number(onCallTimeoutSec) || 1800);

  // 4a. Reservations that never turned into a dial.
  const [q] = await run(
    db,
    `UPDATE csv_data
        SET call_status       = COALESCE(pre_dial_status, ?),
            status_changed_at = NOW(),
            pre_dial_status   = NULL,
            assigned_to       = NULL,
            claimed_at        = NULL
      WHERE call_status = ?
        AND claimed_at IS NOT NULL
        AND claimed_at < DATE_SUB(NOW(), INTERVAL ? SECOND)`,
    [LEAD_STATUS.NEW, LEAD_STATUS.QUEUED, claimSec],
  );

  // 4b/4c. Attempts whose outcome event never arrived. Collected first so each
  // one can be finalised through the normal rules (and logged) rather than
  // bulk-stamped, which would skip retry scheduling.
  const [stuck] = await run(
    db,
    `SELECT id, call_status, campaign_id, list_id
       FROM csv_data
      WHERE ( (call_status IN (?, ?) AND claimed_at < DATE_SUB(NOW(), INTERVAL ? SECOND))
              OR (call_status = ? AND claimed_at < DATE_SUB(NOW(), INTERVAL ? SECOND)) )
        AND claimed_at IS NOT NULL
      LIMIT 200`,
    [
      LEAD_STATUS.DIALING,
      LEAD_STATUS.RINGING,
      ringSec,
      LEAD_STATUS.CONNECTED,
      callSec,
    ],
  );

  const ids = [];
  for (const row of stuck) {
    const status =
      normalizeStatus(row.call_status) === LEAD_STATUS.CONNECTED
        ? LEAD_STATUS.CANCELLED
        : LEAD_STATUS.FAILED;
    await finalizeLead(db, { leadId: row.id, status });
    ids.push(row.id);
  }

  return { cancelled: Number(q.affectedRows) || 0, failed: ids.length, ids };
}

/* ------------------------------------------------------------------ *
 *  5. CALL HISTORY  —  one row per attempt, from dial to hangup
 * ------------------------------------------------------------------ */

/**
 * Open the history row the moment the attempt goes out. Every attempt gets one
 * — including those that never reach an agent (employeeId stays NULL).
 * @returns {Promise<number|null>} calls.id
 */
async function startCallRecord(db, o) {
  try {
    const [res] = await run(
      db,
      `INSERT INTO calls
         (employee_id, campaign_id, csv_data_id, list_id, gateway_id, phone_number,
          contact_name, direction, dial_source, attempt_no, status, lead_status,
          channel_id, started_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, NOW())`,
      [
        o.employeeId ?? null,
        o.campaignId ?? null,
        o.leadId ?? null,
        o.listId ?? null,
        o.gatewayId ?? null,
        String(o.phoneNumber || "").slice(0, 32),
        o.contactName ? String(o.contactName).slice(0, 150) : null,
        o.direction || "outbound",
        o.dialSource || "manual",
        Number(o.attemptNo) || 0,
        "dialing",
        LEAD_STATUS.DIALING,
        o.channelId ? String(o.channelId).slice(0, 80) : null,
      ],
    );
    return res.insertId || null;
  } catch (e) {
    console.error("[leadWriter] startCallRecord failed:", e && e.message);
    return null;
  }
}

async function markCallRinging(db, callId) {
  if (!callId) return;
  await run(
    db,
    "UPDATE calls SET status = 'ringing', lead_status = ? WHERE id = ? AND status = 'dialing'",
    [LEAD_STATUS.RINGING, callId],
  ).catch(() => {});
}

/** Customer picked up — freeze the ring time and start the talk clock. */
async function markCallAnswered(db, callId) {
  if (!callId) return;
  await run(
    db,
    `UPDATE calls
        SET answered_at   = COALESCE(answered_at, NOW()),
            ring_seconds  = GREATEST(TIMESTAMPDIFF(SECOND, started_at, NOW()), 0)
      WHERE id = ?`,
    [callId],
  ).catch(() => {});
}

/** An agent is bridged in — the attempt is now a real conversation. */
async function markCallConnected(db, callId, employeeId) {
  if (!callId) return;
  await run(
    db,
    `UPDATE calls
        SET status = 'connected', lead_status = ?,
            employee_id = COALESCE(?, employee_id),
            answered_at = COALESCE(answered_at, NOW())
      WHERE id = ?`,
    [LEAD_STATUS.CONNECTED, employeeId ?? null, callId],
  ).catch(() => {});
}

/**
 * Close the history row. duration_seconds is talk time (0 when the customer
 * never answered), matching what the dashboards already report.
 */
async function finishCallRecord(db, callId, { status, leadStatus, hangupCause, employeeId }) {
  if (!callId) return;
  await run(
    db,
    `UPDATE calls
        SET status           = ?,
            lead_status      = ?,
            hangup_cause     = COALESCE(?, hangup_cause),
            employee_id      = COALESCE(?, employee_id),
            ended_at         = COALESCE(ended_at, NOW()),
            duration_seconds = CASE
              WHEN answered_at IS NOT NULL
              THEN GREATEST(TIMESTAMPDIFF(SECOND, answered_at, NOW()), 0)
              ELSE 0 END
      WHERE id = ?`,
    [
      statusToCallStatus(status),
      normalizeStatus(leadStatus || status),
      hangupCause ? String(hangupCause).slice(0, 64) : null,
      employeeId ?? null,
      callId,
    ],
  ).catch((e) => console.error("[leadWriter] finishCallRecord failed:", e && e.message));
}

/**
 * Close out history rows left "in flight" by a crash. Run once at startup so
 * the live dashboard never shows phantom active calls.
 */
async function recoverStaleCallRecords(db, maxAgeSec) {
  const age = Math.max(60, Number(maxAgeSec) || 3600);
  const [res] = await run(
    db,
    `UPDATE calls
        SET status = 'failed', lead_status = ?, hangup_cause = 'stale',
            ended_at = COALESCE(ended_at, NOW())
      WHERE status IN ('dialing','ringing')
        AND started_at < DATE_SUB(NOW(), INTERVAL ? SECOND)`,
    [LEAD_STATUS.FAILED, age],
  );
  return Number(res.affectedRows) || 0;
}

module.exports = {
  run,
  selectOne,
  reserveLead,
  markDialing,
  markRinging,
  markConnected,
  touchClaim,
  finalizeLead,
  releaseClaim,
  cancelReservation,
  recoverStaleLeads,
  startCallRecord,
  markCallRinging,
  markCallAnswered,
  markCallConnected,
  finishCallRecord,
  recoverStaleCallRecords,
  IN_FLIGHT_STATUSES,
};

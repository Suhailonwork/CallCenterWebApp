/* =====================================================================
 *  dialEligibility.js — the ONE definition of "which lead may be dialed".
 *
 *  CommonJS on purpose: predictive-engine.js (root, CJS) requires it and
 *  the Next.js API routes import it, so the predictive engine and the
 *  manual /api/employee/dialer/next claim can never drift apart.
 *
 *  VICIdial-style eligibility — a lead is claimable when:
 *    - it belongs to one of the campaign's ACTIVE lists  (list gate), AND
 *    - its claim is free or expired                      (claim gate), AND
 *    - EITHER of two branches matches:
 *      a) NORMAL : called=0 (not dialed since last reset) AND
 *                  call_status IN campaign.dial_statuses
 *      b) RECYCLE: call_status matches a recycle rule AND the rule's
 *                  delay has passed since last_call_at AND
 *                  recycle_attempts < the rule's max_attempts.
 *                  (Ignores `called` — VICIdial recycle behavior.)
 *
 *  The SELECT also returns `via_recycle` (0/1) so callers can increment
 *  recycle_attempts only for branch-b claims.
 * ===================================================================== */
"use strict";

/** Statuses a campaign dials when campaigns.dial_statuses is NULL.
 *  This app's vocabulary for VICIdial's NEW / NA / B. */
const DEFAULT_DIAL_STATUSES = ["NEW", "no_answer", "busy"];

/** Recycle rules new campaigns start with (auto-retry no-pickups, bounded).
 *  Kept in sync with db/migrate-lists.mjs which backfills the same defaults. */
const DEFAULT_RECYCLE_RULES = [
  { status: "no_answer", delay_min: 60, max_attempts: 3 },
  { status: "busy", delay_min: 30, max_attempts: 3 },
];

/** mysql2 returns JSON columns already parsed; tolerate string/NULL too. */
function parseJsonColumn(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

/**
 * campaigns.dial_statuses -> string[].
 * NULL / unparseable = the default set; an explicit [] means "dial nothing
 * via the normal branch" (admin switched every status off).
 */
function parseDialStatuses(raw) {
  const v = parseJsonColumn(raw);
  if (!Array.isArray(v)) return DEFAULT_DIAL_STATUSES.slice();
  return v.map((s) => String(s).slice(0, 32)).filter((s) => s.length > 0);
}

/**
 * campaigns.recycle_rules -> sanitized [{status, delay_min, max_attempts}].
 * NULL / unparseable / [] = no recycling. Malformed entries are dropped.
 */
function parseRecycleRules(raw) {
  const v = parseJsonColumn(raw);
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const r of v) {
    if (!r || typeof r !== "object") continue;
    const status = String(r.status || "").slice(0, 32);
    const delayMin = Math.floor(Number(r.delay_min));
    const maxAttempts = Math.floor(Number(r.max_attempts));
    if (!status || !Number.isFinite(delayMin) || delayMin < 0) continue;
    if (!Number.isFinite(maxAttempts) || maxAttempts < 1) continue;
    out.push({ status, delay_min: delayMin, max_attempts: maxAttempts });
  }
  return out;
}

/**
 * Build the atomic claim SELECT (FIFO + FOR UPDATE).
 *
 * @param {object} opts
 * @param {number}   opts.campaignId
 * @param {number[]} opts.listIds          the campaign's ACTIVE list ids (non-empty)
 * @param {string[]} opts.dialStatuses     from parseDialStatuses()
 * @param {Array<{status:string,delay_min:number,max_attempts:number}>} opts.recycleRules
 * @param {number}   opts.claimTimeoutSec  claimed_at older than this is re-offered
 * @returns {{sql: string, params: any[]} | null} null when NOTHING could ever
 *          match (no lists, or no dial statuses and no recycle rules) — the
 *          caller should skip the DB round-trip and log why.
 */
function buildClaimSelect({ campaignId, listIds, dialStatuses, recycleRules, claimTimeoutSec }) {
  if (!Array.isArray(listIds) || listIds.length === 0) return null;
  if (dialStatuses.length === 0 && recycleRules.length === 0) return null;

  const params = [];

  // Branch a) NORMAL — not dialed since last reset, status is dialable.
  let normalSql = "0"; // dial_statuses = [] -> branch a never matches
  if (dialStatuses.length > 0) {
    normalSql = `(called = 0 AND call_status IN (${dialStatuses.map(() => "?").join(",")}))`;
  }

  // The via_recycle flag needs the same params again (SELECT list renders
  // before WHERE, so push them for the flag first, then for the WHERE).
  const flagParams = dialStatuses.slice();

  const listSql = listIds.map(() => "?").join(",");

  // Branch b) RECYCLE — one OR-term per rule.
  const recycleTerms = [];
  const recycleParams = [];
  for (const r of recycleRules) {
    recycleTerms.push(
      `(call_status = ? AND recycle_attempts < ? AND last_call_at IS NOT NULL
        AND last_call_at <= DATE_SUB(NOW(), INTERVAL ? MINUTE))`,
    );
    recycleParams.push(r.status, r.max_attempts, r.delay_min);
  }
  const branchSql = [normalSql, ...recycleTerms].join("\n           OR ");

  params.push(
    ...flagParams,          // via_recycle flag IN(...)
    campaignId,
    ...listIds,
    claimTimeoutSec,
    ...dialStatuses,        // branch a IN(...)
    ...recycleParams,
  );

  const sql = `SELECT id, phone_number, name, email, company, custom_fields,
       ${dialStatuses.length > 0 ? `(NOT (called = 0 AND call_status IN (${dialStatuses.map(() => "?").join(",")})))` : "1"} AS via_recycle
  FROM csv_data
 WHERE campaign_id = ?
   AND list_id IN (${listSql})
   AND (claimed_at IS NULL OR claimed_at < DATE_SUB(NOW(), INTERVAL ? SECOND))
   AND (${branchSql})
 ORDER BY id ASC
 LIMIT 1
 FOR UPDATE`;

  return { sql, params };
}

module.exports = {
  DEFAULT_DIAL_STATUSES,
  DEFAULT_RECYCLE_RULES,
  parseJsonColumn,
  parseDialStatuses,
  parseRecycleRules,
  buildClaimSelect,
};

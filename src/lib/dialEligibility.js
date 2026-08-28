/* =====================================================================
 *  dialEligibility.js — the ONE definition of "which lead may be dialed".
 *
 *  CommonJS on purpose: predictive-engine.js (root, CJS) requires it and the
 *  Next.js API routes import it, so the predictive engine and the manual
 *  /api/employee/dialer/next claim can never drift apart.
 *
 *  A lead is claimable when ALL of these hold:
 *
 *   1. LIST GATE     — it sits in one of the campaign's ACTIVE lists.
 *   2. CLAIM GATE    — nobody holds it: either no claim at all, or a claim
 *                      that expired AND the lead is not mid-call. A live call
 *                      always holds a claim, so a customer already on the
 *                      phone can never be selected a second time; a *stale*
 *                      in-flight lead is left for the engine's recovery sweep
 *                      (which lands it on a real terminal status first).
 *   3. RETRY GATE    — next_retry_at is NULL or already due.
 *   4. ATTEMPT CAP   — campaigns.retry_count (0 = unlimited) not reached.
 *   5. DISPOSITION   — the agent's last disposition did not close the lead.
 *                      A code whose rule closes it (PAID, WN, Legal Notice…)
 *                      is refused here whatever status it rests on and
 *                      whatever the campaign dials.
 *   6. ONE OF:
 *      a) FRESH   : called = 0 AND call_status IN campaign.dial_statuses
 *      b) RECYCLE : call_status matches a recycle rule, the rule's delay has
 *                   passed since last_call_at, and recycle_attempts is below
 *                   the rule's max_attempts. (Ignores `called` — this is
 *                   VICIdial recycle behaviour.)
 *      c) DISPOSITION : last_disposition matches a disposition rule that
 *                   redials on its own timer (dispositionRules.js). This is
 *                   what lets a rule bring a lead back on a status the
 *                   campaign has no recycle rule for — a broken promise
 *                   resting on CONNECTED, say — and it is the same rule
 *                   planNextAttempt used when it scheduled the retry.
 *
 *  The SELECT returns `via_recycle` (0/1) so callers increment
 *  recycle_attempts only for claims that did not come through branch a, and
 *  uses FOR UPDATE SKIP LOCKED so concurrent dialer workers step over each
 *  other's rows instead of serialising on the same one.
 * ===================================================================== */
"use strict";

const {
  LEAD_STATUS,
  IN_FLIGHT_STATUSES,
  TERMINAL_STATUSES,
  DEFAULT_DIAL_STATUSES,
  DEFAULT_RECYCLE_RULES,
  normalizeStatus,
  parseJsonColumn,
  parseDialStatuses,
  parseRecycleRules,
} = require("./leadStatus.js");

const {
  DISPOSITION_ACTION,
  parseDispositionRules,
  blockedDispositionCodes,
  dispositionRetryTerms,
} = require("./dispositionRules.js");

/** Column list every claim returns — the dialer and the screen pop both use it. */
const LEAD_COLUMNS = `id, campaign_id, list_id, phone_number, name, email, company,
       custom_fields, call_status, called, call_count, recycle_attempts, priority,
       last_call_at, assigned_to`;

/** ORDER BY fragment for campaigns.lead_order. Priority always wins first so
 *  injected callbacks jump the queue regardless of the configured order. */
function orderByFor(leadOrder) {
  switch (String(leadOrder || "oldest")) {
    case "newest":
      return "priority DESC, id DESC";
    case "priority":
      return "priority DESC, last_call_at IS NOT NULL, last_call_at ASC, id ASC";
    case "random":
      return "priority DESC, RAND()";
    case "oldest":
    default:
      return "priority DESC, id ASC";
  }
}

/**
 * Build the atomic claim SELECT.
 *
 * @param {object} opts
 * @param {number}   opts.campaignId
 * @param {number[]} opts.listIds          the campaign's ACTIVE list ids (non-empty)
 * @param {string[]} opts.dialStatuses     from parseDialStatuses()
 * @param {Array<{status:string,delay_min:number,max_attempts:number}>} opts.recycleRules
 * @param {number}   opts.claimTimeoutSec  a claim older than this is re-offered
 * @param {number}   [opts.maxAttempts]    campaigns.retry_count (0 = unlimited)
 * @param {string}   [opts.leadOrder]      campaigns.lead_order
 * @param {number}   [opts.limit]          how many leads to lock (predictive over-dial)
 * @param {number[]} [opts.excludeIds]     lead ids already in flight in this process
 * @param {unknown}  [opts.dispositionRules] campaigns.disposition_rules (raw column or
 *                   an already-parsed override map). The catalogue defaults in
 *                   dispositionRules.js apply either way.
 * @returns {{sql: string, params: any[]} | null} null when NOTHING could ever
 *          match (no lists, or no dial statuses and no recycle rules) — the
 *          caller should skip the round-trip and log the reason.
 */
function buildClaimSelect({
  campaignId,
  listIds,
  dialStatuses,
  recycleRules,
  claimTimeoutSec,
  maxAttempts,
  leadOrder,
  limit,
  excludeIds,
  dispositionRules,
}) {
  if (!Array.isArray(listIds) || listIds.length === 0) return null;
  const statuses = Array.isArray(dialStatuses) ? dialStatuses.map(normalizeStatus) : [];
  const rules = Array.isArray(recycleRules) ? recycleRules : [];
  if (statuses.length === 0 && rules.length === 0) return null;

  // Disposition rules always apply: the catalogue's defaults are the baseline
  // and campaigns.disposition_rules only overrides parts of it, so a lead the
  // agent closed is refused even by a campaign that never configured anything.
  const dispoOverrides = parseDispositionRules(dispositionRules);
  const blockedCodes = blockedDispositionCodes(dispoOverrides);
  const dispoTerms = dispositionRetryTerms(dispoOverrides);

  const cap = Number(maxAttempts) || 0;
  const rowLimit = Math.max(1, Math.min(Number(limit) || 1, 100));
  const exclude = Array.isArray(excludeIds)
    ? excludeIds.filter((n) => Number.isInteger(n) && n > 0).slice(0, 500)
    : [];

  const params = [];

  // A due callback is ALWAYS dialable — an agent promised the customer this
  // call, so it does not depend on the campaign's dial_statuses.
  const freshStatuses = statuses.includes(LEAD_STATUS.CALLBACK)
    ? statuses
    : statuses.concat(LEAD_STATUS.CALLBACK);

  // ---- SELECT list: via_recycle needs the dial statuses rendered first ----
  const viaRecycleSql = `(NOT (called = 0 AND call_status IN (${freshStatuses
    .map(() => "?")
    .join(",")})))`;
  params.push(...freshStatuses);

  // ---- WHERE ----
  params.push(campaignId, ...listIds);

  // Claim gate + mid-call guard in one condition (see the header comment).
  const inFlightSql = IN_FLIGHT_STATUSES.map(() => "?").join(",");
  params.push(claimTimeoutSec, ...IN_FLIGHT_STATUSES);

  // Attempt cap.
  params.push(cap, cap);

  // Disposition gate: a lead the agent closed (PAID, Wrong Number, Legal
  // Notice…) never comes back, whatever status it rests on. This is the
  // eligibility half of the disposition rules — planNextAttempt already
  // refused to schedule a retry for it, and this refuses the claim as well.
  let blockedSql = "";
  if (blockedCodes.length > 0) {
    blockedSql = `\n   AND (last_disposition IS NULL
             OR last_disposition NOT IN (${blockedCodes.map(() => "?").join(",")}))`;
    params.push(...blockedCodes);
  }

  // Exclusions come BEFORE the branch clause in the SQL below, so their params
  // must be pushed before the branch's. Params bind positionally: pushing these
  // later silently shifts every placeholder after the attempt cap.
  let excludeSql = "";
  if (exclude.length > 0) {
    excludeSql = `\n   AND id NOT IN (${exclude.map(() => "?").join(",")})`;
    params.push(...exclude);
  }

  // Branch a) FRESH — never dialled since the last reset, status is dialable.
  // dial_statuses = [] still lets a due CALLBACK through, and nothing else.
  const freshSql = `(called = 0 AND call_status IN (${freshStatuses
    .map(() => "?")
    .join(",")}))`;
  params.push(...freshStatuses);

  // Branch b) RECYCLE — one OR-term per rule.
  const recycleTerms = [];
  for (const r of rules) {
    recycleTerms.push(
      `(call_status = ? AND recycle_attempts < ? AND last_call_at IS NOT NULL
             AND last_call_at <= DATE_SUB(NOW(), INTERVAL ? MINUTE))`,
    );
    params.push(r.status, r.max_attempts, r.delay_min);
  }

  // Branch c) DISPOSITION — one OR-term per rule that redials on its own timer.
  // A retry term repeats the delay the rule scheduled with; a callback term
  // does not, because the appointment time is already in next_retry_at (gated
  // above) and an appointment the agent promised always comes back.
  const terminalSql = TERMINAL_STATUSES.map(() => "?").join(",");
  const dispoSqlTerms = [];
  for (const t of dispoTerms) {
    if (t.action === DISPOSITION_ACTION.CALLBACK) {
      dispoSqlTerms.push(`(last_disposition = ? AND call_status = ?)`);
      params.push(t.code, LEAD_STATUS.CALLBACK);
    } else {
      dispoSqlTerms.push(
        `(last_disposition = ? AND recycle_attempts < ? AND last_call_at IS NOT NULL
             AND last_call_at <= DATE_SUB(NOW(), INTERVAL ? MINUTE)
             AND call_status NOT IN (${terminalSql}))`,
      );
      params.push(t.code, t.max_attempts, t.delay_min, ...TERMINAL_STATUSES);
    }
  }

  const branchSql = [freshSql, ...recycleTerms, ...dispoSqlTerms].join("\n            OR ");

  const sql = `SELECT ${LEAD_COLUMNS},
       ${viaRecycleSql} AS via_recycle
  FROM csv_data
 WHERE campaign_id = ?
   AND list_id IN (${listIds.map(() => "?").join(",")})
   AND ( claimed_at IS NULL
         OR ( claimed_at < DATE_SUB(NOW(), INTERVAL ? SECOND)
              AND call_status NOT IN (${inFlightSql}) ) )
   AND (next_retry_at IS NULL OR next_retry_at <= NOW())
   AND (? = 0 OR call_count < ?)${blockedSql}${excludeSql}
   AND ( ${branchSql} )
 ORDER BY ${orderByFor(leadOrder)}
 LIMIT ${rowLimit}
 FOR UPDATE SKIP LOCKED`;

  // selectParamCount = placeholders consumed by the SELECT list, so a caller
  // that strips the SELECT list (buildDialableCount) can realign the params.
  return { sql, params, selectParamCount: freshStatuses.length };
}

/**
 * Count leads that are dialable RIGHT NOW for a campaign — the number the live
 * dashboard shows and the engine uses to decide there is nothing left to dial.
 * Same predicate as buildClaimSelect minus the locking.
 */
function buildDialableCount(opts) {
  const claim = buildClaimSelect({ ...opts, limit: 1 });
  if (!claim) return null;
  const sql = claim.sql
    .replace(/^SELECT[\s\S]*?\n  FROM csv_data/, "SELECT COUNT(*) AS n\n  FROM csv_data")
    .replace(/\n ORDER BY[\s\S]*$/, "");
  // The via_recycle placeholders live in the removed SELECT list — drop their
  // params so the remaining ones still line up with the WHERE clause.
  return { sql, params: claim.params.slice(claim.selectParamCount) };
}

module.exports = {
  LEAD_STATUS,
  LEAD_COLUMNS,
  DEFAULT_DIAL_STATUSES,
  DEFAULT_RECYCLE_RULES,
  parseJsonColumn,
  parseDialStatuses,
  parseRecycleRules,
  orderByFor,
  buildClaimSelect,
  buildDialableCount,
};

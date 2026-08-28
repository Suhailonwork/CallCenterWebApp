/* =====================================================================
 *  leadStatus.js — the ONE definition of a lead's lifecycle.
 *
 *  CommonJS on purpose: predictive-engine.js and ari-app.js (root, CJS)
 *  require it and the Next.js API routes import it, so the dialer and the
 *  web app can never disagree about what a status means.
 *
 *  Lifecycle (VICIdial-style):
 *
 *      NEW ──▶ QUEUED ──▶ DIALING ──▶ RINGING ──┬─▶ CONNECTED
 *                                                ├─▶ BUSY
 *                                                ├─▶ NO_ANSWER
 *                                                ├─▶ FAILED
 *                                                ├─▶ VOICEMAIL
 *                                                └─▶ CANCELLED
 *                                                        │
 *                          (recycle rule allows a retry) │
 *                                    next_retry_at set ◀─┤
 *                                                        │
 *                       (attempts exhausted / terminal) ─┴─▶ COMPLETED
 *
 *  Invariant enforced everywhere: **a lead never stays NEW once it has been
 *  dialled.** Every dial writes DIALING immediately and every call outcome
 *  writes a terminal status, so there is no window where called=1 and the
 *  status still reads NEW.
 *
 *  Statuses are stored UPPERCASE. The database collation is case-insensitive
 *  (utf8mb4_*_ci), so campaigns still holding the older lowercase spellings in
 *  `dial_statuses` / `recycle_rules` keep matching without reconfiguration.
 * ===================================================================== */
"use strict";

/** Canonical lead statuses. */
const LEAD_STATUS = Object.freeze({
  NEW: "NEW",
  QUEUED: "QUEUED",
  DIALING: "DIALING",
  RINGING: "RINGING",
  CONNECTED: "CONNECTED",
  BUSY: "BUSY",
  NO_ANSWER: "NO_ANSWER",
  FAILED: "FAILED",
  VOICEMAIL: "VOICEMAIL",
  CANCELLED: "CANCELLED",
  WRONG_NUMBER: "WRONG_NUMBER",
  DNC: "DNC",
  /** A scheduled callback that has come due — always dialable, whatever the
   *  campaign's dial_statuses say, because an agent promised this call. */
  CALLBACK: "CALLBACK",
  COMPLETED: "COMPLETED",
});

const ALL_STATUSES = Object.freeze(Object.values(LEAD_STATUS));

/** Statuses that mean "a call is happening right now". */
const IN_FLIGHT_STATUSES = Object.freeze([
  LEAD_STATUS.QUEUED,
  LEAD_STATUS.DIALING,
  LEAD_STATUS.RINGING,
  LEAD_STATUS.CONNECTED,
]);

/** Statuses the lead can never leave on its own — only a list RESET revives them. */
const TERMINAL_STATUSES = Object.freeze([
  LEAD_STATUS.COMPLETED,
  LEAD_STATUS.WRONG_NUMBER,
  LEAD_STATUS.DNC,
]);

/**
 * Outcomes that must never be dialled again, whatever a campaign's
 * dial_statuses or recycle_rules happen to say.
 *
 * Deliberately just DNC: the customer asked not to be called, which is a legal
 * obligation rather than a campaign preference, so no configuration may
 * override it.
 *
 * Everything else — including CONNECTED, CANCELLED, WRONG_NUMBER and
 * COMPLETED — is the admin's call. Writing a recycle rule for a status is an
 * explicit instruction to redial it, and the engine honours it: a lead that
 * already reached that status becomes eligible as soon as the rule's delay has
 * passed, with no list RESET needed. This is what makes moving a list to a
 * campaign with different rules work — the new campaign's rules govern leads
 * that were called under the old one. The UI warns when a status is usually
 * final; it does not forbid it.
 */
const NON_REDIALABLE_STATUSES = Object.freeze([LEAD_STATUS.DNC]);

/** Statuses a campaign dials when campaigns.dial_statuses is NULL. */
const DEFAULT_DIAL_STATUSES = Object.freeze([
  LEAD_STATUS.NEW,
  LEAD_STATUS.NO_ANSWER,
  LEAD_STATUS.BUSY,
]);

/** Recycle rules a new campaign starts with (bounded auto-retry). */
const DEFAULT_RECYCLE_RULES = Object.freeze([
  { status: LEAD_STATUS.NO_ANSWER, delay_min: 60, max_attempts: 3 },
  { status: LEAD_STATUS.BUSY, delay_min: 30, max_attempts: 3 },
  { status: LEAD_STATUS.FAILED, delay_min: 30, max_attempts: 2 },
]);

/** Legacy / alternate spellings accepted from older data, configs and the UI. */
const STATUS_ALIASES = Object.freeze({
  NA: LEAD_STATUS.NO_ANSWER,
  NOANSWER: LEAD_STATUS.NO_ANSWER,
  "NO-ANSWER": LEAD_STATUS.NO_ANSWER,
  B: LEAD_STATUS.BUSY,
  CANCELED: LEAD_STATUS.CANCELLED,
  ABANDONED: LEAD_STATUS.CANCELLED,
  DROP: LEAD_STATUS.CANCELLED,
  CALLBK: LEAD_STATUS.CALLBACK,
  CB: LEAD_STATUS.CALLBACK,
  MACHINE: LEAD_STATUS.VOICEMAIL,
  AM: LEAD_STATUS.VOICEMAIL,
  WRONGNUMBER: LEAD_STATUS.WRONG_NUMBER,
  "WRONG-NUMBER": LEAD_STATUS.WRONG_NUMBER,
  SALE: LEAD_STATUS.COMPLETED,
  DONE: LEAD_STATUS.COMPLETED,
});

/**
 * Normalise any status spelling to the canonical UPPERCASE form.
 * An unrecognised value is returned uppercased and trimmed rather than
 * discarded — an operator may legitimately dial on a custom status.
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeStatus(raw) {
  const s = String(raw == null ? "" : raw)
    .trim()
    .toUpperCase()
    .slice(0, 32);
  if (!s) return LEAD_STATUS.NEW;
  return STATUS_ALIASES[s] || s;
}

/** @param {unknown} status */
function isTerminal(status) {
  return TERMINAL_STATUSES.includes(normalizeStatus(status));
}

/** @param {unknown} status */
function isInFlight(status) {
  return IN_FLIGHT_STATUSES.includes(normalizeStatus(status));
}

/* ------------------------------------------------------------------ *
 *  Disposition  <->  lead status
 * ------------------------------------------------------------------ */

/** Agent wrap-up disposition (calls.status vocabulary) -> lead status. */
const DISPOSITION_TO_STATUS = Object.freeze({
  connected: LEAD_STATUS.CONNECTED,
  no_answer: LEAD_STATUS.NO_ANSWER,
  busy: LEAD_STATUS.BUSY,
  voicemail: LEAD_STATUS.VOICEMAIL,
  failed: LEAD_STATUS.FAILED,
  wrong_number: LEAD_STATUS.WRONG_NUMBER,
  cancelled: LEAD_STATUS.CANCELLED,
  abandoned: LEAD_STATUS.CANCELLED,
  completed: LEAD_STATUS.COMPLETED,
  dialing: LEAD_STATUS.DIALING,
  ringing: LEAD_STATUS.RINGING,
});

/** Lead status -> the calls.status ENUM value used for the history row. */
const STATUS_TO_CALL_STATUS = Object.freeze({
  [LEAD_STATUS.NEW]: "failed",
  [LEAD_STATUS.QUEUED]: "dialing",
  [LEAD_STATUS.DIALING]: "dialing",
  [LEAD_STATUS.RINGING]: "ringing",
  [LEAD_STATUS.CONNECTED]: "connected",
  [LEAD_STATUS.BUSY]: "busy",
  [LEAD_STATUS.NO_ANSWER]: "no_answer",
  [LEAD_STATUS.FAILED]: "failed",
  [LEAD_STATUS.VOICEMAIL]: "voicemail",
  [LEAD_STATUS.CANCELLED]: "cancelled",
  [LEAD_STATUS.WRONG_NUMBER]: "wrong_number",
  [LEAD_STATUS.DNC]: "wrong_number",
  [LEAD_STATUS.CALLBACK]: "no_answer",
  [LEAD_STATUS.COMPLETED]: "completed",
});

/** @param {unknown} disposition @returns {string} canonical lead status */
function dispositionToStatus(disposition) {
  const key = String(disposition == null ? "" : disposition).trim().toLowerCase();
  return DISPOSITION_TO_STATUS[key] || normalizeStatus(disposition);
}

/** @param {unknown} status @returns {string} a valid calls.status ENUM value */
function statusToCallStatus(status) {
  return STATUS_TO_CALL_STATUS[normalizeStatus(status)] || "failed";
}

/* ------------------------------------------------------------------ *
 *  Asterisk hangup cause  ->  lead status
 * ------------------------------------------------------------------ */

/** Q.850 cause code -> lead status for a call that never got answered. */
const Q850_TO_STATUS = Object.freeze({
  1: LEAD_STATUS.WRONG_NUMBER, // unallocated number
  2: LEAD_STATUS.FAILED, // no route to network
  3: LEAD_STATUS.FAILED, // no route to destination
  16: LEAD_STATUS.NO_ANSWER, // normal clearing before answer
  17: LEAD_STATUS.BUSY, // user busy
  18: LEAD_STATUS.NO_ANSWER, // no user responding
  19: LEAD_STATUS.NO_ANSWER, // no answer from user (alerted)
  20: LEAD_STATUS.NO_ANSWER, // subscriber absent
  21: LEAD_STATUS.FAILED, // call rejected
  22: LEAD_STATUS.WRONG_NUMBER, // number changed
  26: LEAD_STATUS.NO_ANSWER, // non-selected user clearing
  27: LEAD_STATUS.FAILED, // destination out of order
  28: LEAD_STATUS.WRONG_NUMBER, // invalid number format
  29: LEAD_STATUS.FAILED, // facility rejected
  31: LEAD_STATUS.NO_ANSWER, // normal, unspecified
  34: LEAD_STATUS.FAILED, // no circuit / channel available
  38: LEAD_STATUS.FAILED, // network out of order
  41: LEAD_STATUS.FAILED, // temporary failure
  42: LEAD_STATUS.FAILED, // switching equipment congestion
  44: LEAD_STATUS.FAILED, // requested channel unavailable
  47: LEAD_STATUS.FAILED, // resource unavailable
  50: LEAD_STATUS.FAILED, // facility not subscribed
  57: LEAD_STATUS.FAILED, // bearer capability not authorised
  58: LEAD_STATUS.FAILED, // bearer capability not available
  65: LEAD_STATUS.FAILED, // bearer capability not implemented
  66: LEAD_STATUS.FAILED, // channel type not implemented
  79: LEAD_STATUS.FAILED, // service not implemented
  88: LEAD_STATUS.FAILED, // incompatible destination
  95: LEAD_STATUS.FAILED, // invalid message
  102: LEAD_STATUS.NO_ANSWER, // recovery on timer expiry
  111: LEAD_STATUS.FAILED, // protocol error
  127: LEAD_STATUS.FAILED, // interworking, unspecified
});

/** Internal (non-Q.850) reasons the dialer itself raises. */
const INTERNAL_CAUSE_TO_STATUS = Object.freeze({
  "no-answer": LEAD_STATUS.NO_ANSWER,
  timeout: LEAD_STATUS.NO_ANSWER,
  "dial-timeout": LEAD_STATUS.NO_ANSWER,
  busy: LEAD_STATUS.BUSY,
  congestion: LEAD_STATUS.FAILED,
  "originate-failed": LEAD_STATUS.FAILED,
  "gateway-unavailable": LEAD_STATUS.FAILED,
  "no-gateway": LEAD_STATUS.FAILED,
  "amd-machine": LEAD_STATUS.VOICEMAIL,
  machine: LEAD_STATUS.VOICEMAIL,
  abandoned: LEAD_STATUS.CANCELLED,
  "no-agent": LEAD_STATUS.CANCELLED,
  "agent-unavailable": LEAD_STATUS.CANCELLED,
  "ended-before-agent-connect": LEAD_STATUS.CANCELLED,
  cancelled: LEAD_STATUS.CANCELLED,
  "campaign-stopped": LEAD_STATUS.CANCELLED,
  stale: LEAD_STATUS.FAILED,
  "engine-restart": LEAD_STATUS.FAILED,
});

/**
 * Decide the lead status produced by a finished call attempt.
 *
 * @param {object} o
 * @param {boolean} o.answered   did the customer leg answer?
 * @param {boolean} [o.bridged]  did an agent actually get bridged in?
 * @param {number|string|null} [o.causeCode]  Asterisk Q.850 cause
 * @param {string|null} [o.causeText]         Asterisk cause text or an internal reason
 * @returns {string} canonical lead status
 */
function outcomeToStatus({ answered, bridged, causeCode, causeText }) {
  const text = String(causeText == null ? "" : causeText).trim().toLowerCase();
  if (text && INTERNAL_CAUSE_TO_STATUS[text]) return INTERNAL_CAUSE_TO_STATUS[text];

  if (answered) {
    // The customer picked up. Bridged to an agent = a real conversation;
    // not bridged = the dialer dropped it (abandoned / agent never came).
    return bridged ? LEAD_STATUS.CONNECTED : LEAD_STATUS.CANCELLED;
  }

  const code = Number(causeCode);
  if (Number.isFinite(code) && Q850_TO_STATUS[code]) return Q850_TO_STATUS[code];

  // Fall back to matching the human-readable cause text Asterisk sends.
  if (text.includes("busy")) return LEAD_STATUS.BUSY;
  if (text.includes("congestion")) return LEAD_STATUS.FAILED;
  if (text.includes("answer") || text.includes("absent")) return LEAD_STATUS.NO_ANSWER;
  if (text.includes("cancel")) return LEAD_STATUS.CANCELLED;

  // Unanswered with a cause we do not recognise — GSM gateways very often
  // report cause 0 / "Unknown" for a call the customer simply did not pick up.
  // NO_ANSWER is both the truthful reading and the safe one: it is the status
  // operators actually write recycle rules for, so the lead stays in the redial
  // queue instead of being parked on FAILED, which usually has no rule and
  // therefore ends the lead's life after a single unanswered ring.
  return LEAD_STATUS.NO_ANSWER;
}

/* ------------------------------------------------------------------ *
 *  Retry / recycle rules
 * ------------------------------------------------------------------ */

/** mysql2 returns JSON columns already parsed; tolerate string / NULL too. */
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
 * campaigns.dial_statuses -> canonical string[].
 * NULL / unparseable = the default set; an explicit [] means "dial nothing via
 * the fresh branch" (the admin switched every status off).
 *
 * Non-redialable outcomes are dropped here rather than rejected on save, so a
 * campaign configured before this rule existed becomes safe the moment it is
 * read — no migration, and no way for the engine to see a banned status.
 * @param {unknown} raw
 */
function parseDialStatuses(raw) {
  const v = parseJsonColumn(raw);
  if (!Array.isArray(v)) return DEFAULT_DIAL_STATUSES.slice();
  const out = [];
  for (const s of v) {
    const norm = normalizeStatus(s);
    if (!norm || out.includes(norm)) continue;
    if (NON_REDIALABLE_STATUSES.includes(norm)) continue;
    out.push(norm);
  }
  return out;
}

/**
 * campaigns.recycle_rules -> sanitised [{status, delay_min, max_attempts}].
 * NULL / unparseable / [] = no recycling. Malformed entries are dropped and
 * duplicate statuses collapse to the first (most permissive wins is not safe —
 * first-wins is predictable and matches the editor's ordering).
 * @param {unknown} raw
 * @param {number} [fallbackDelayMin] campaigns.retry_delay_minutes
 */
function parseRecycleRules(raw, fallbackDelayMin) {
  const v = parseJsonColumn(raw);
  if (!Array.isArray(v)) return [];
  const fallback = Number.isFinite(Number(fallbackDelayMin)) ? Number(fallbackDelayMin) : 60;
  const out = [];
  const seen = new Set();
  for (const r of v) {
    if (!r || typeof r !== "object") continue;
    const status = normalizeStatus(r.status);
    if (!status || seen.has(status)) continue;
    // A rule on a non-redialable outcome is never honoured — see the constant.
    if (NON_REDIALABLE_STATUSES.includes(status)) continue;
    let delayMin = Math.floor(Number(r.delay_min));
    if (!Number.isFinite(delayMin) || delayMin < 0) delayMin = fallback;
    const maxAttempts = Math.floor(Number(r.max_attempts));
    if (!Number.isFinite(maxAttempts) || maxAttempts < 1) continue;
    seen.add(status);
    out.push({ status, delay_min: delayMin, max_attempts: maxAttempts });
  }
  return out;
}

/** Find the recycle rule that governs a status (null when there is none). */
function ruleForStatus(recycleRules, status) {
  const s = normalizeStatus(status);
  for (const r of recycleRules) if (r.status === s) return r;
  return null;
}

/**
 * Retry ceiling for a disposition rule that names no max_attempts of its own.
 *
 * The claim query cannot compare against "unlimited", so both it
 * (dispositionRetryTerms in dispositionRules.js) and this planner substitute
 * the same number — otherwise "retry scheduled" could be a lie at the edge.
 */
const DISPOSITION_ATTEMPT_CEILING = 50;

/** Parse a follow-up time from a Date, a MySQL DATETIME or an ISO string. */
function toDate(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v.includes("T") ? v : v.replace(" ", "T"));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Decide what happens to a lead once an attempt has finished.
 *
 * Mirrors exactly what the claim query will later accept, so "retry scheduled"
 * in the log always means the lead really does come back.
 *
 * When the agent saved a DISPOSITION, its rule decides first: the disposition
 * is the agent's reading of the conversation, and it outranks what the line
 * happened to do. Only when there is no disposition (an unanswered attempt the
 * engine finalises on its own) do the campaign's recycle rules decide alone.
 * See dispositionRules.js for the rule vocabulary.
 *
 * @param {object} o
 * @param {string} o.status              status the attempt produced
 * @param {Array}  o.recycleRules        from parseRecycleRules()
 * @param {number} o.recycleAttempts     csv_data.recycle_attempts BEFORE this attempt
 * @param {number} o.callCount           csv_data.call_count INCLUDING this attempt
 * @param {number} [o.maxAttempts]       campaigns.retry_count (0 = unlimited)
 * @param {Date}   [o.now]
 * @param {{action:string, status?:string|null, delay_min?:number|null,
 *          max_attempts?:number|null}} [o.dispositionRule] from resolveDisposition()
 * @param {Date|string} [o.followUpAt]   callback time the agent booked
 * @returns {{status:string, willRetry:boolean, nextRetryAt:Date|null, delayMin:number|null,
 *            reason:string, exhausted:boolean}}
 */
function planNextAttempt({
  status,
  recycleRules,
  recycleAttempts,
  callCount,
  maxAttempts,
  now,
  dispositionRule,
  followUpAt,
}) {
  const at = now instanceof Date ? now : new Date();
  const attempts = Number(recycleAttempts) || 0;
  const calls = Number(callCount) || 0;
  const cap = Number(maxAttempts) || 0; // 0 = unlimited

  // The disposition names the status the lead rests on; without one, the
  // status the line produced stands.
  const rule = dispositionRule || null;
  const s = normalizeStatus(rule && rule.status ? rule.status : status);

  const none = (reason, finalStatus, exhausted) => ({
    status: finalStatus || s,
    willRetry: false,
    nextRetryAt: null,
    delayMin: null,
    reason,
    exhausted: Boolean(exhausted),
  });

  // A hard-banned status can never come back, whatever is configured.
  if (NON_REDIALABLE_STATUSES.includes(s)) return none("non-redialable", s, true);

  if (rule) {
    switch (rule.action) {
      case "dnc":
        return none("disposition-dnc", LEAD_STATUS.DNC, true);

      case "close":
        return none(
          "disposition-close",
          TERMINAL_STATUSES.includes(s) ? s : LEAD_STATUS.COMPLETED,
          true,
        );

      case "skip":
        return none("disposition-skip", s, false);

      case "callback": {
        // An appointment the agent promised the customer. It outranks the
        // campaign's attempt cap — the same reading the engine already takes
        // when it injects a due callback ahead of everything else.
        const booked = toDate(followUpAt);
        const delay = rule.delay_min == null ? 60 : rule.delay_min;
        const nextRetryAt = booked && booked > at ? booked : new Date(at.getTime() + delay * 60_000);
        return {
          status: LEAD_STATUS.CALLBACK,
          willRetry: true,
          nextRetryAt,
          delayMin: booked ? Math.max(0, Math.round((booked.getTime() - at.getTime()) / 60_000)) : delay,
          reason: "disposition-callback",
          exhausted: false,
        };
      }

      case "retry":
      default: {
        // A campaign-level cap on total attempts still wins — the lead is done.
        if (cap > 0 && calls >= cap) {
          return none("max-attempts-reached", LEAD_STATUS.COMPLETED, true);
        }
        // No delay of its own: fall through to the campaign's recycle rules
        // for the status this disposition lands on.
        if (rule.delay_min == null) break;
        const max =
          rule.max_attempts == null ? DISPOSITION_ATTEMPT_CEILING : rule.max_attempts;
        if (attempts >= max) return none("disposition-attempts-exhausted", s, false);
        return {
          status: s,
          willRetry: true,
          nextRetryAt: new Date(at.getTime() + rule.delay_min * 60_000),
          delayMin: rule.delay_min,
          reason: "disposition-retry",
          exhausted: false,
        };
      }
    }
  }

  // A normally-final status rests here unless the campaign explicitly wrote a
  // recycle rule for it. With a rule it falls through and is treated like any
  // other status, so the claim query and this planner agree on who comes back.
  if (TERMINAL_STATUSES.includes(s) && !ruleForStatus(recycleRules, s)) {
    return none("terminal-status", s, true);
  }

  // A campaign-level cap on total attempts always wins — the lead is finished.
  if (cap > 0 && calls >= cap) {
    return none("max-attempts-reached", LEAD_STATUS.COMPLETED, true);
  }

  const recycleRule = ruleForStatus(recycleRules, s);
  if (!recycleRule) return none("no-recycle-rule", s, false);

  // Same comparison the claim query uses, so the two can never disagree.
  if (attempts >= recycleRule.max_attempts) {
    return none("recycle-attempts-exhausted", s, false);
  }

  const nextRetryAt = new Date(at.getTime() + recycleRule.delay_min * 60_000);
  return {
    status: s,
    willRetry: true,
    nextRetryAt,
    delayMin: recycleRule.delay_min,
    reason: "retry-scheduled",
    exhausted: false,
  };
}

/** MySQL DATETIME string in local (pool) time — mysql2 accepts Date too, but
 *  building the string keeps prepared-statement params free of TZ surprises. */
function toSqlDateTime(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

module.exports = {
  LEAD_STATUS,
  ALL_STATUSES,
  IN_FLIGHT_STATUSES,
  TERMINAL_STATUSES,
  NON_REDIALABLE_STATUSES,
  DEFAULT_DIAL_STATUSES,
  DEFAULT_RECYCLE_RULES,
  DISPOSITION_ATTEMPT_CEILING,
  normalizeStatus,
  isTerminal,
  isInFlight,
  dispositionToStatus,
  statusToCallStatus,
  outcomeToStatus,
  parseJsonColumn,
  parseDialStatuses,
  parseRecycleRules,
  ruleForStatus,
  planNextAttempt,
  toSqlDateTime,
};

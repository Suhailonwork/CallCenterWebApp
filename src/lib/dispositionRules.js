/* =====================================================================
 *  dispositionRules.js — the ONE definition of what an agent's disposition
 *  means for the dialer.
 *
 *  A wrap-up produces two different things:
 *
 *    • the CALL STATUS  — what the phone line did (connected / no answer /
 *      busy …). The agent picks it only in MANUAL mode; in predictive and
 *      ratio mode the customer is already on the line when the screen pops,
 *      so the dialer knows the line result and the field is hidden.
 *
 *    • the DISPOSITION REASON — what the conversation MEANT (PTP, PAID,
 *      Wrong Number …). The agent always picks this one, and it is what
 *      decides the lead's future: the status it rests on, whether it is
 *      redialled, after how long, how many times, and whether it is closed
 *      for good.
 *
 *  Every dialer mode therefore ends in the same place: a disposition rule is
 *  resolved here and handed to planNextAttempt() / the claim query, so the UI
 *  and the back end can never disagree about what happens next.
 *
 *  ACTIONS
 *    retry     — put the lead back on the redial queue. delay_min /
 *                max_attempts override the campaign's recycle rule for the
 *                resulting status; omitted, the campaign's rule is used.
 *    callback  — an appointment. The lead rests on CALLBACK and comes back at
 *                the follow-up time the agent booked (delay_min is the
 *                fallback when no time was given).
 *    skip      — done with for now: no retry is scheduled and the lead simply
 *                rests on its status. It returns only if the campaign's own
 *                dial/recycle rules cover that status.
 *    close     — finished. The lead lands on a terminal status and the claim
 *                query refuses it from then on, whatever the campaign dials.
 *    dnc       — do not call. Hard stop; nothing may override it.
 *
 *  CommonJS on purpose: predictive-engine.js (root, CJS) requires it for the
 *  eligibility rules, the API routes import it for the wrap-up, and the
 *  Dialer imports the catalogue so the dropdowns and the rules are one list.
 * ===================================================================== */
"use strict";

const {
  LEAD_STATUS,
  TERMINAL_STATUSES,
  DISPOSITION_ATTEMPT_CEILING,
  normalizeStatus,
  parseJsonColumn,
} = require("./leadStatus.js");

/** What the dialer does with a lead once a disposition is saved. */
const DISPOSITION_ACTION = Object.freeze({
  RETRY: "retry",
  CALLBACK: "callback",
  SKIP: "skip",
  CLOSE: "close",
  DNC: "dnc",
});

const ALL_ACTIONS = Object.freeze(Object.values(DISPOSITION_ACTION));

/** Actions after which the lead must never be claimed again. */
const BLOCKING_ACTIONS = Object.freeze([DISPOSITION_ACTION.CLOSE, DISPOSITION_ACTION.DNC]);

/** Actions that put the lead back on the redial queue. */
const RETRYING_ACTIONS = Object.freeze([DISPOSITION_ACTION.RETRY, DISPOSITION_ACTION.CALLBACK]);

/**
 * The disposition catalogue: the codes the agent picks from, the reasons under
 * each one, and the dialing rule each produces.
 *
 * `reasons[].rule` is a partial override applied on top of the code's rule —
 * this is what makes the DIALING RULE follow the selected REASON and not just
 * the code ("Number busy" retries in 30 minutes as BUSY; "Fraud Case" closes
 * the lead; "Permanent - Unemployed" parks it).
 *
 * `pay: true` marks a reason that commits the customer to a payment, so the
 * wrap-up asks for amount / date / mode and pre-fills the follow-up.
 *
 * @typedef {'retry'|'callback'|'skip'|'close'|'dnc'} DispositionAction
 * @typedef {{status?: string, action?: DispositionAction, delay_min?: number|null,
 *            max_attempts?: number|null, requires_followup?: boolean}} DispositionRuleInput
 * @typedef {{code: string, label: string, status: string, action: DispositionAction,
 *            delay_min: number|null, max_attempts: number|null,
 *            requires_followup: boolean}} DispositionRule
 */
const DISPOSITION_CATALOG = Object.freeze([
  {
    code: "PAID",
    label: "Paid",
    rule: { status: LEAD_STATUS.COMPLETED, action: DISPOSITION_ACTION.CLOSE },
    reasons: [
      { value: "Full Paid", label: "Full Paid" },
      { value: "Settlement Paid", label: "Settlement Paid" },
      {
        value: "Partial Paid",
        label: "Partial Paid",
        // Part of the debt is still open — keep the lead alive on a long timer.
        rule: { status: LEAD_STATUS.CONNECTED, action: DISPOSITION_ACTION.RETRY, delay_min: 10080, max_attempts: 3 },
      },
    ],
  },
  {
    code: "PC",
    label: "Payment in progress",
    rule: {
      status: LEAD_STATUS.CONNECTED,
      action: DISPOSITION_ACTION.RETRY,
      delay_min: 240,
      max_attempts: 2,
    },
    reasons: [
      { value: "On the way (Branch)", label: "On the way (Branch)" },
      { value: "On the way (Bank)", label: "On the way (Bank)" },
      { value: "Customer doing online Payment", label: "Customer doing online Payment" },
    ],
  },
  {
    code: "PTP",
    label: "Promise to pay",
    rule: {
      status: LEAD_STATUS.CALLBACK,
      action: DISPOSITION_ACTION.CALLBACK,
      delay_min: 1440,
      requires_followup: true,
    },
    reasons: [{ value: "Customer ready to pay", label: "Customer ready to pay", pay: true }],
  },
  {
    code: "CBPTP",
    label: "Callback — future PTP",
    rule: {
      status: LEAD_STATUS.CALLBACK,
      action: DISPOSITION_ACTION.CALLBACK,
      delay_min: 1440,
      requires_followup: true,
    },
    reasons: [{ value: "Future PTP", label: "Future PTP", pay: true }],
  },
  {
    code: "SETT",
    label: "Settlement",
    rule: {
      status: LEAD_STATUS.CALLBACK,
      action: DISPOSITION_ACTION.CALLBACK,
      delay_min: 1440,
      requires_followup: true,
    },
    reasons: [
      { value: "Customer ready to pay settlement", label: "Customer ready to pay settlement", pay: true },
    ],
  },
  {
    code: "BPTP",
    label: "Broken promise",
    rule: {
      status: LEAD_STATUS.CONNECTED,
      action: DISPOSITION_ACTION.RETRY,
      delay_min: 1440,
      max_attempts: 3,
    },
    reasons: [
      { value: "Excuse - asking days for payment", label: "Excuse - asking days for payment" },
      {
        value: "Emergency Reason / Death / Accident",
        label: "Emergency Reason / Death / Accident",
        rule: { delay_min: 4320, max_attempts: 2 },
      },
    ],
  },
  {
    code: "CB",
    label: "Call back",
    rule: {
      status: LEAD_STATUS.CALLBACK,
      action: DISPOSITION_ACTION.CALLBACK,
      delay_min: 240,
      requires_followup: true,
    },
    reasons: [
      { value: "Customer in Emergency", label: "Customer in Emergency" },
      { value: "Call back later", label: "Call back later" },
      { value: "Out of station", label: "Out of station" },
      { value: "Other", label: "Other" },
      { value: "Statement verification", label: "Statement verification" },
    ],
  },
  {
    code: "FI",
    label: "Financial inability",
    rule: {
      status: LEAD_STATUS.CONNECTED,
      action: DISPOSITION_ACTION.RETRY,
      delay_min: 10080,
      max_attempts: 2,
    },
    reasons: [
      {
        value: "PFI-Permanent - Unemployed / Out of job",
        label: "PFI — Permanent (unemployed / out of job)",
        // Permanent: park it. No retry is scheduled, but the campaign's own
        // rules may still bring it back — this is not a close.
        rule: { action: DISPOSITION_ACTION.SKIP },
      },
      { value: "SFI-Short Term - Business Issue", label: "SFI — Short term (business issue)" },
      { value: "Vehicle Viability / EMI Affordability", label: "Vehicle viability / EMI affordability" },
    ],
  },
  {
    code: "NFI",
    label: "Non-financial inability",
    rule: {
      status: LEAD_STATUS.CONNECTED,
      action: DISPOSITION_ACTION.RETRY,
      delay_min: 4320,
      max_attempts: 2,
    },
    reasons: [
      { value: "CUACC-Customer Met with Accident", label: "CUACC — Customer met with accident" },
      { value: "VEHAC-Vehicle Met with Accident", label: "VEHAC — Vehicle met with accident" },
      { value: "MEDIS-Medical Issue", label: "MEDIS — Medical issue" },
      {
        value: "FMEXP-Death of Family Member",
        label: "FMEXP — Death of family member",
        rule: { delay_min: 10080, max_attempts: 1 },
      },
    ],
  },
  {
    code: "SI",
    label: "Service issue",
    rule: {
      status: LEAD_STATUS.CONNECTED,
      action: DISPOSITION_ACTION.RETRY,
      delay_min: 2880,
      max_attempts: 3,
    },
    reasons: [
      { value: "NORC-RC Copy not Received", label: "NORC — RC copy not received" },
      { value: "TISSU-Technical Issue in Vehicle", label: "TISSU — Technical issue in vehicle" },
      { value: "EMIDP-EMI or DP Issue", label: "EMIDP — EMI or DP issue" },
    ],
  },
  {
    code: "TNC",
    label: "Tried, not connected",
    rule: {
      status: LEAD_STATUS.NO_ANSWER,
      action: DISPOSITION_ACTION.RETRY,
      delay_min: 60,
      max_attempts: 5,
    },
    reasons: [
      { value: "Ringing", label: "Ringing" },
      { value: "Not Reachable", label: "Not reachable", rule: { delay_min: 120 } },
      { value: "Switch off", label: "Switch off", rule: { delay_min: 180 } },
      { value: "Number busy", label: "Number busy", rule: { status: LEAD_STATUS.BUSY, delay_min: 30 } },
      { value: "Beep Silence", label: "Beep silence", rule: { status: LEAD_STATUS.VOICEMAIL } },
      { value: "No voice / Voice issue", label: "No voice / voice issue", rule: { status: LEAD_STATUS.FAILED, delay_min: 30 } },
    ],
  },
  {
    code: "SKIP",
    label: "Skip",
    rule: { status: LEAD_STATUS.CANCELLED, action: DISPOSITION_ACTION.SKIP },
    reasons: [
      { value: "MIGR-Customer Migrated / Shift", label: "MIGR — Customer migrated / shifted" },
      { value: "CUNA-Not Available at visit place", label: "CUNA — Not available at visit place" },
      {
        value: "FRAUD-Fraud Case",
        label: "FRAUD — Fraud case",
        rule: { status: LEAD_STATUS.COMPLETED, action: DISPOSITION_ACTION.CLOSE },
      },
    ],
  },
  {
    code: "LM",
    label: "Left message",
    rule: {
      status: LEAD_STATUS.VOICEMAIL,
      action: DISPOSITION_ACTION.RETRY,
      delay_min: 1440,
      max_attempts: 3,
    },
    reasons: [{ value: "Left Message", label: "Left message" }],
  },
  {
    code: "LPR",
    label: "Language problem",
    rule: {
      status: LEAD_STATUS.CONNECTED,
      action: DISPOSITION_ACTION.RETRY,
      delay_min: 120,
      max_attempts: 2,
    },
    reasons: [{ value: "Language Problem", label: "Language problem" }],
  },
  {
    code: "LN",
    label: "Legal notice",
    rule: { status: LEAD_STATUS.COMPLETED, action: DISPOSITION_ACTION.CLOSE },
    reasons: [{ value: "Legal Notice", label: "Legal notice" }],
  },
  {
    code: "PTV",
    label: "Pick the vehicle",
    rule: { status: LEAD_STATUS.COMPLETED, action: DISPOSITION_ACTION.CLOSE },
    reasons: [{ value: "Pick the Vehicle", label: "Pick the vehicle" }],
  },
  {
    code: "WN",
    label: "Wrong number",
    rule: { status: LEAD_STATUS.WRONG_NUMBER, action: DISPOSITION_ACTION.CLOSE },
    reasons: [{ value: "Wrong Number", label: "Wrong number" }],
  },
  {
    code: "ID",
    label: "Intentional defaulter",
    rule: {
      status: LEAD_STATUS.CONNECTED,
      action: DISPOSITION_ACTION.RETRY,
      delay_min: 10080,
      max_attempts: 2,
    },
    reasons: [{ value: "Intentional Defaulter", label: "Intentional defaulter" }],
  },
  {
    code: "VPC",
    label: "Vehicle in police custody",
    rule: { status: LEAD_STATUS.COMPLETED, action: DISPOSITION_ACTION.CLOSE },
    reasons: [{ value: "Vehicle under police custody", label: "Vehicle under police custody" }],
  },
  {
    code: "VDLR",
    label: "Vehicle with dealer",
    rule: { status: LEAD_STATUS.COMPLETED, action: DISPOSITION_ACTION.CLOSE },
    reasons: [{ value: "Vehicle with dealer", label: "Vehicle with dealer" }],
  },
  {
    code: "CD",
    label: "Call drop",
    rule: {
      status: LEAD_STATUS.FAILED,
      action: DISPOSITION_ACTION.RETRY,
      delay_min: 5,
      max_attempts: 3,
    },
    reasons: [{ value: "Call drop", label: "Call drop" }],
  },
  {
    code: "Repo",
    label: "Vehicle repossessed",
    rule: { status: LEAD_STATUS.COMPLETED, action: DISPOSITION_ACTION.CLOSE },
    reasons: [{ value: "Vehicle Repo", label: "Vehicle repo" }],
  },
  {
    code: "Account",
    label: "Account closed",
    rule: { status: LEAD_STATUS.COMPLETED, action: DISPOSITION_ACTION.CLOSE },
    reasons: [{ value: "Account Close", label: "Account close" }],
  },
]);

/** code (uppercased) -> catalogue entry. Codes compare case-insensitively so a
 *  disposition saved as "repo" still finds the "Repo" rule. */
const CATALOG_BY_CODE = new Map(DISPOSITION_CATALOG.map((d) => [d.code.toUpperCase(), d]));

/** The dialing rule used when a disposition code is not in the catalogue: keep
 *  the lead exactly as the campaign's own rules would have it. */
const FALLBACK_RULE = Object.freeze({
  status: null,
  action: DISPOSITION_ACTION.RETRY,
  delay_min: null,
  max_attempts: null,
  requires_followup: false,
});

/** @param {unknown} raw @returns {string} the canonical disposition code */
function normalizeCode(raw) {
  const s = String(raw == null ? "" : raw).trim().slice(0, 32);
  if (!s) return "";
  const hit = CATALOG_BY_CODE.get(s.toUpperCase());
  return hit ? hit.code : s;
}

/** Positive integer or null. */
function intOrNull(v, { min = 0, max = 525600 } = {}) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/** Merge a partial override onto a rule, dropping anything unusable. */
function mergeRule(base, patch) {
  const out = { ...base };
  if (!patch || typeof patch !== "object") return out;

  if (patch.status != null && String(patch.status).trim() !== "") {
    out.status = normalizeStatus(patch.status);
  }
  if (patch.action != null) {
    const a = String(patch.action).trim().toLowerCase();
    if (ALL_ACTIONS.includes(a)) out.action = a;
  }
  if ("delay_min" in patch) out.delay_min = intOrNull(patch.delay_min, { min: 0, max: 525600 });
  if ("max_attempts" in patch) out.max_attempts = intOrNull(patch.max_attempts, { min: 1, max: 50 });
  if ("requires_followup" in patch) out.requires_followup = Boolean(patch.requires_followup);
  return out;
}

/**
 * campaigns.disposition_rules -> a sanitised { CODE: rule } override map.
 * NULL / unparseable / [] = no overrides, i.e. the catalogue defaults.
 *
 * Accepts either shape so hand-written configuration is forgiving:
 *   { "PTP": {action:"callback", delay_min:120} }
 *   [ {code:"PTP", action:"callback", delay_min:120} ]
 *
 * Per-reason overrides live under `reasons`: {"TNC": {reasons: {"Switch off": {delay_min: 360}}}}
 *
 * @param {unknown} raw
 * @returns {Record<string, DispositionRuleInput & {reasons?: Record<string, DispositionRuleInput>}>}
 */
function parseDispositionRules(raw) {
  const v = parseJsonColumn(raw);
  const out = {};
  if (!v || typeof v !== "object") return out;

  const entries = Array.isArray(v)
    ? v.map((r) => [r && r.code, r]).filter(([code]) => code)
    : Object.entries(v);

  for (const [rawCode, rawRule] of entries) {
    const code = normalizeCode(rawCode);
    if (!code || !rawRule || typeof rawRule !== "object") continue;
    const patch = mergeRule({ ...FALLBACK_RULE, status: null }, rawRule);
    const entry = {};
    // Only carry the keys that were actually given: an override must not
    // silently replace a catalogue default it never mentioned.
    for (const key of ["status", "action", "delay_min", "max_attempts", "requires_followup"]) {
      if (key in rawRule) entry[key] = patch[key];
    }
    if (rawRule.reasons && typeof rawRule.reasons === "object" && !Array.isArray(rawRule.reasons)) {
      const reasons = {};
      for (const [reasonKey, reasonRule] of Object.entries(rawRule.reasons)) {
        if (!reasonRule || typeof reasonRule !== "object") continue;
        const merged = mergeRule({ ...FALLBACK_RULE, status: null }, reasonRule);
        const sub = {};
        for (const key of ["status", "action", "delay_min", "max_attempts", "requires_followup"]) {
          if (key in reasonRule) sub[key] = merged[key];
        }
        if (Object.keys(sub).length > 0) reasons[String(reasonKey).slice(0, 120)] = sub;
      }
      if (Object.keys(reasons).length > 0) entry.reasons = reasons;
    }
    if (Object.keys(entry).length > 0) out[code] = entry;
  }
  return out;
}

/**
 * Resolve the rule for one wrap-up: catalogue default for the code, then the
 * reason's override, then the campaign's override for the code, then the
 * campaign's override for that reason. Later wins.
 *
 * @param {object} o
 * @param {unknown} o.code       the DISPO code the agent picked (PTP, TNC…)
 * @param {unknown} [o.reason]   the reason under that code
 * @param {Record<string, any>} [o.overrides]  from parseDispositionRules()
 * @returns {(DispositionRule & {code:string, reason:string|null, known:boolean,
 *            requiresPayment:boolean}) | null} null when no code was given at all.
 */
function resolveDisposition({ code, reason, overrides }) {
  const dispoCode = normalizeCode(code);
  if (!dispoCode) return null;

  const entry = CATALOG_BY_CODE.get(dispoCode.toUpperCase()) || null;
  const reasonText = reason == null ? "" : String(reason).trim();
  const reasonEntry = entry && reasonText
    ? entry.reasons.find((r) => r.value.toLowerCase() === reasonText.toLowerCase()) || null
    : null;

  let rule = mergeRule(FALLBACK_RULE, entry ? entry.rule : null);
  if (reasonEntry) rule = mergeRule(rule, reasonEntry.rule);

  const ov = (overrides && overrides[dispoCode]) || null;
  if (ov) {
    rule = mergeRule(rule, ov);
    if (ov.reasons && reasonText) {
      const key = Object.keys(ov.reasons).find((k) => k.toLowerCase() === reasonText.toLowerCase());
      if (key) rule = mergeRule(rule, ov.reasons[key]);
    }
  }

  // A callback is an appointment — it can only rest on CALLBACK, and a close
  // can only rest on a status the claim query will actually refuse.
  if (rule.action === DISPOSITION_ACTION.CALLBACK) rule.status = LEAD_STATUS.CALLBACK;
  if (rule.action === DISPOSITION_ACTION.DNC) rule.status = LEAD_STATUS.DNC;
  if (rule.action === DISPOSITION_ACTION.CLOSE && !TERMINAL_STATUSES.includes(rule.status)) {
    rule.status = LEAD_STATUS.COMPLETED;
  }

  return {
    ...rule,
    code: dispoCode,
    reason: reasonText || null,
    known: Boolean(entry),
    requiresPayment: Boolean(reasonEntry && reasonEntry.pay),
  };
}

/** Does this rule stop the lead from ever being claimed again? */
function isBlockingRule(rule) {
  return Boolean(rule) && BLOCKING_ACTIONS.includes(rule.action);
}

/**
 * Every disposition code that closes a lead for good, for the claim query's
 * exclusion list. A lead carrying one of these in `last_disposition` is never
 * offered again, whatever status it rests on and whatever the campaign dials.
 *
 * @param {Record<string, any>} [overrides] from parseDispositionRules()
 * @returns {string[]}
 */
function blockedDispositionCodes(overrides) {
  const out = [];
  const seen = new Set();
  const consider = (code) => {
    const rule = resolveDisposition({ code, overrides });
    if (rule && isBlockingRule(rule) && !seen.has(rule.code)) {
      seen.add(rule.code);
      out.push(rule.code);
    }
  };
  for (const d of DISPOSITION_CATALOG) consider(d.code);
  for (const code of Object.keys(overrides || {})) consider(code);
  return out;
}

/**
 * Disposition codes that put a lead back on the queue on their own timer, as
 * terms for the claim query. This is what makes ELIGIBILITY follow the
 * disposition even when the status the lead rests on has no campaign recycle
 * rule (a BPTP lead resting on CONNECTED, say).
 *
 * Codes whose retry rule has no delay of its own are left out: they fall
 * through to the campaign's recycle rules, which the claim query already
 * covers. Callback codes are always included — their timing lives in
 * next_retry_at (the time the agent booked), which the claim query gates on
 * anyway, so they carry no delay of their own here.
 *
 * @param {Record<string, any>} [overrides] from parseDispositionRules()
 * @returns {{code:string, action:DispositionAction, delay_min:number|null, max_attempts:number}[]}
 */
function dispositionRetryTerms(overrides) {
  const out = [];
  const seen = new Set();
  const consider = (code) => {
    const rule = resolveDisposition({ code, overrides });
    if (!rule || seen.has(rule.code)) return;
    if (!RETRYING_ACTIONS.includes(rule.action)) return;
    const isCallback = rule.action === DISPOSITION_ACTION.CALLBACK;
    if (!isCallback && rule.delay_min == null) return;
    seen.add(rule.code);
    out.push({
      code: rule.code,
      action: rule.action,
      delay_min: isCallback ? null : rule.delay_min,
      // A rule with no cap of its own still needs a number the SQL can compare
      // against — the same one planNextAttempt substitutes, so the claim query
      // and the planner cannot disagree about the last attempt.
      max_attempts: rule.max_attempts == null ? DISPOSITION_ATTEMPT_CEILING : rule.max_attempts,
    });
  };
  for (const d of DISPOSITION_CATALOG) consider(d.code);
  for (const code of Object.keys(overrides || {})) consider(code);
  return out;
}

/** One-line human summary of what a rule will do — shown in the wrap-up form. */
function describeRule(rule) {
  if (!rule) return "";
  const mins = (n) => {
    if (n == null) return "the campaign's retry delay";
    if (n < 60) return `${n} min`;
    if (n < 1440) return `${Math.round((n / 60) * 10) / 10} h`.replace(".0", "");
    return `${Math.round((n / 1440) * 10) / 10} day${n >= 2880 ? "s" : ""}`.replace(".0", "");
  };
  switch (rule.action) {
    case DISPOSITION_ACTION.CLOSE:
      return `Lead is closed as ${rule.status || LEAD_STATUS.COMPLETED} — it will not be dialled again.`;
    case DISPOSITION_ACTION.DNC:
      return "Lead is marked DNC — it can never be dialled again.";
    case DISPOSITION_ACTION.SKIP:
      return `No retry is scheduled — the lead rests on ${rule.status || "its current status"}.`;
    case DISPOSITION_ACTION.CALLBACK:
      return rule.requires_followup
        ? "Books a callback — pick the date and time below."
        : `Books a callback in ${mins(rule.delay_min)}.`;
    case DISPOSITION_ACTION.RETRY:
    default:
      return rule.max_attempts == null
        ? `Redialled after ${mins(rule.delay_min)} while the campaign's rules allow.`
        : `Redialled after ${mins(rule.delay_min)}, up to ${rule.max_attempts} time${rule.max_attempts === 1 ? "" : "s"}.`;
  }
}

module.exports = {
  DISPOSITION_ACTION,
  ALL_ACTIONS,
  BLOCKING_ACTIONS,
  RETRYING_ACTIONS,
  DISPOSITION_CATALOG,
  normalizeCode,
  parseDispositionRules,
  resolveDisposition,
  isBlockingRule,
  blockedDispositionCodes,
  dispositionRetryTerms,
  describeRule,
};

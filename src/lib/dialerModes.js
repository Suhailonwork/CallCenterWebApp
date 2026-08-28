/* =====================================================================
 *  dialerModes.js — the ONE definition of what each dialer mode may do.
 *
 *  A campaign's `dialer_type` is not a label, it is a contract. Every part of
 *  the system asks this module the same three questions, so a mode can never
 *  mean one thing in the UI and another in the engine:
 *
 *    isEngineDriven(mode)  — may the SERVER originate calls for it?
 *    isPredictive(mode)    — may the ADAPTIVE pacing algorithm run for it?
 *    pacingFieldsFor(mode) — which pacing columns does it own?
 *
 *  The four modes:
 *
 *  ┌────────────┬───────────────┬──────────────────────────────────────────┐
 *  │ mode       │ who dials     │ how many lines                           │
 *  ├────────────┼───────────────┼──────────────────────────────────────────┤
 *  │ manual     │ the agent     │ one, when they press Call                │
 *  │ inbound    │ the customer  │ none — the campaign only receives        │
 *  │ ratio      │ the server    │ FIXED: dial_ratio × ready agents         │
 *  │ predictive │ the server    │ COMPUTED every tick from answer rate,    │
 *  │            │               │ handle time, agents about to free up and │
 *  │            │               │ the abandon budget                       │
 *  └────────────┴───────────────┴──────────────────────────────────────────┘
 *
 *  The distinction that matters: **ratio dialing is not predictive dialing.**
 *  A ratio campaign opens exactly the number of lines it was configured to
 *  open and never adapts; only a predictive campaign measures the queue and
 *  changes its own pace. Nothing in the adaptive path may ever run for a
 *  ratio, manual or inbound campaign, and this module is what makes that
 *  checkable in one place instead of re-derived at each call site.
 *
 *  CommonJS on purpose: predictive-engine.js and server.mjs (root, CJS/ESM)
 *  and the Next.js routes and components all read the same definition.
 * ===================================================================== */
"use strict";

/** @typedef {'predictive'|'ratio'|'manual'|'inbound'} DialerMode */

const DIALER_MODE = Object.freeze({
  PREDICTIVE: "predictive",
  RATIO: "ratio",
  MANUAL: "manual",
  INBOUND: "inbound",
});

const ALL_MODES = Object.freeze(Object.values(DIALER_MODE));

/**
 * What each mode is allowed to do. `pacing` lists the campaign columns the
 * mode owns — a PATCH may not write any other pacing column for it, and the
 * UI must not offer one.
 *
 * Note which columns are NOT pacing and therefore belong to every mode:
 * retry_count, retry_delay_minutes, dial_timeout_sec, lead_order,
 * callbacks_enabled, recording_enabled and the calling window all describe the
 * campaign's leads and telephony, not how hard the server dials.
 */
const MODE_SPEC = Object.freeze({
  [DIALER_MODE.PREDICTIVE]: {
    label: "Predictive",
    /** The server originates without an agent asking for each call. */
    engineDriven: true,
    /** The adaptive algorithm computes the line count every tick. */
    predictivePacing: true,
    /** Pacing columns this mode owns. */
    pacing: ["dial_ratio", "max_abandon_pct", "wrapup_seconds"],
    summary:
      "The server paces itself: lines are computed each second from the answer " +
      "rate, how long calls last, how many agents are about to free up and the " +
      "abandon budget. dial_ratio is the CEILING, not the setting.",
  },
  [DIALER_MODE.RATIO]: {
    label: "Ratio",
    engineDriven: true,
    predictivePacing: false,
    // A fixed ratio is the mode's definition, not adaptive pacing. There is no
    // max_abandon_pct here: the global compliance cutoff applies instead, and
    // it only ever stops over-dialing — it never paces.
    pacing: ["dial_ratio"],
    summary:
      "The server opens exactly dial_ratio lines per ready agent and never " +
      "adapts. No answer-rate or handle-time statistics are consulted.",
  },
  [DIALER_MODE.MANUAL]: {
    label: "Manual",
    engineDriven: false,
    predictivePacing: false,
    pacing: [],
    summary:
      "The agent dials each contact. The server never originates, never claims " +
      "leads for pacing and never counts these agents as dialable capacity.",
  },
  [DIALER_MODE.INBOUND]: {
    label: "Inbound",
    engineDriven: false,
    predictivePacing: false,
    pacing: [],
    summary: "Receives calls only. The server never originates.",
  },
});

/** Every pacing column any mode can own — the set the API gates on. */
const ALL_PACING_FIELDS = Object.freeze(
  [...new Set(Object.values(MODE_SPEC).flatMap((s) => s.pacing))],
);

/**
 * Fold any spelling to a canonical mode. An unknown value is treated as
 * MANUAL: the safe reading is always "the server does not dial for this".
 * @param {unknown} raw
 * @returns {DialerMode}
 */
function normalizeMode(raw) {
  const s = String(raw == null ? "" : raw).trim().toLowerCase();
  return ALL_MODES.includes(s) ? /** @type {DialerMode} */ (s) : DIALER_MODE.MANUAL;
}

/** @param {unknown} mode */
function specFor(mode) {
  return MODE_SPEC[normalizeMode(mode)];
}

/**
 * May the server originate calls for this mode?
 * False for manual and inbound — the engine skips them entirely.
 * @param {unknown} mode
 */
function isEngineDriven(mode) {
  return specFor(mode).engineDriven;
}

/**
 * May the ADAPTIVE pacing algorithm run for this mode? Predictive only.
 * A ratio campaign is engine-driven but never predictive.
 * @param {unknown} mode
 */
function isPredictive(mode) {
  return specFor(mode).predictivePacing;
}

/**
 * The pacing columns this mode owns. Anything outside this list must be
 * refused by the API and hidden by the UI.
 * @param {unknown} mode
 * @returns {string[]}
 */
function pacingFieldsFor(mode) {
  return specFor(mode).pacing.slice();
}

/**
 * @param {unknown} mode
 * @param {string} field
 * @returns {boolean} may this mode set this pacing column?
 */
function modeOwnsPacingField(mode, field) {
  return specFor(mode).pacing.includes(field);
}

/**
 * Pacing columns present in `input` that the mode does not own.
 * The API reports these back so a caller is told what was refused rather than
 * having it silently dropped.
 * @param {unknown} mode
 * @param {Record<string, unknown>} input
 * @returns {string[]}
 */
function disallowedPacingFields(mode, input) {
  if (!input || typeof input !== "object") return [];
  return ALL_PACING_FIELDS.filter(
    (f) => input[f] !== undefined && !modeOwnsPacingField(mode, f),
  );
}

/** One-line description of how the mode dials — shown in the admin UI. */
function describeMode(mode) {
  return specFor(mode).summary;
}

/** @param {unknown} mode */
function labelFor(mode) {
  return specFor(mode).label;
}

module.exports = {
  DIALER_MODE,
  ALL_MODES,
  ALL_PACING_FIELDS,
  MODE_SPEC,
  normalizeMode,
  isEngineDriven,
  isPredictive,
  pacingFieldsFor,
  modeOwnsPacingField,
  disallowedPacingFields,
  describeMode,
  labelFor,
};

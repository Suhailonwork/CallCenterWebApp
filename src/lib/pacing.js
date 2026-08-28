/* =====================================================================
 *  pacing.js — how many lines to open, as pure arithmetic.
 *
 *  Two models, deliberately two functions. The engine supplies the measured
 *  inputs (it owns the clocks, the registry and the gateway pool) and this
 *  module owns the decision, so the rule a campaign is paced by can be read,
 *  reasoned about and tested without a database or a phone switch.
 *
 *  Which one runs is decided by the campaign's mode and nothing else —
 *  see src/lib/dialerModes.js.
 * ===================================================================== */
"use strict";

/** Below this answer rate the forecast would ask for absurd line counts. */
const MIN_ANSWER_RATE = 0.05;

/** Fraction of the abandon budget at which damping starts. */
const GOVERNOR_SOFT_ZONE = 0.75;

/**
 * PREDICTIVE — the adaptive forecast.
 *
 * The question a predictive dialer answers every second is not "how many
 * agents are free" but "how many will be free when a call I place now is
 * answered". Everything here follows from that:
 *
 *   expectedFree = ready + agents whose call ends within one ring cycle
 *   lines        = expectedFree / answerRate      ← the over-dial
 *   lines        = governor(lines)                ← abandon budget
 *   target       = min(lines, ready × ceiling)    ← the operator's cap
 *
 * The governor is proportional, not a switch: inside 75% of the budget the
 * forecast is used as measured, from there to the limit it is damped linearly
 * toward one line per ready agent, and over the limit it IS one line per ready
 * agent. A campaign therefore slows down before it breaks its abandon target
 * instead of oscillating around it.
 *
 * Progressive (one line per ready agent) is the floor in every case: an agent
 * sitting idle must always get a call, whatever the statistics say.
 *
 * @param {object} o
 * @param {number} o.ready           READY agents the engine may pace for
 * @param {number} [o.freeingSoon]   agents whose current call ends within a ring cycle
 * @param {number} [o.answerRate]    measured answered/attempts, 0..1 (1 = pace progressively)
 * @param {number} [o.ceiling]       campaigns.dial_ratio — the MOST lines per agent
 * @param {number} [o.abandonPct]    measured abandon rate, 0..100
 * @param {number} [o.maxAbandonPct] the campaign's budget, 0..100 (0 = ungoverned)
 * @returns {{target:number, ratio:number, governor:number, expectedFree:number}}
 *          target = lines that should be live; ratio = target per ready agent.
 */
function predictiveTarget({
  ready,
  freeingSoon,
  answerRate,
  ceiling,
  abandonPct,
  maxAbandonPct,
}) {
  const readyCount = Math.max(0, Math.floor(Number(ready) || 0));
  const soon = Math.max(0, Math.floor(Number(freeingSoon) || 0));
  const expectedFree = readyCount + soon;
  if (expectedFree <= 0) {
    return { target: 0, ratio: 0, governor: 1, expectedFree: 0 };
  }

  const rate = Math.min(1, Math.max(MIN_ANSWER_RATE, Number(answerRate) || 1));
  const cap = Math.max(1, Number(ceiling) || 1);
  const abandoning = Math.max(0, Number(abandonPct) || 0);
  const budget = Math.max(0, Number(maxAbandonPct) || 0);

  // 1. lines that produce `expectedFree` live conversations
  let lines = expectedFree / rate;

  // 2. the abandon governor
  let governor = 1;
  if (budget > 0) {
    const soft = budget * GOVERNOR_SOFT_ZONE;
    if (abandoning > budget) governor = 0;
    else if (abandoning > soft) governor = 1 - (abandoning - soft) / (budget - soft);
  }
  if (governor < 1) {
    const progressive = Math.max(readyCount, 1);
    lines = progressive + (lines - progressive) * Math.max(0, governor);
  }

  // 3. the operator's ceiling is a promise, so it wins over the forecast
  const maxLines = Math.max(1, readyCount || 1) * cap;
  const target = Math.max(1, Math.min(Math.ceil(lines), Math.floor(maxLines)));

  return {
    target,
    ratio: readyCount > 0 ? target / readyCount : target,
    governor,
    expectedFree,
  };
}

/**
 * RATIO — fixed, and deliberately blind.
 *
 * dial_ratio lines per READY agent. No answer rate, no handle time, no
 * forecast: a ratio dialer that adapted would be a predictive dialer with a
 * misleading name, and the whole point of the mode is that an operator can
 * predict exactly what it will do.
 *
 * `overBudget` is the compliance cutoff, not pacing — it only ever drops the
 * campaign to one line per agent, and it never raises or computes anything.
 *
 * @param {object} o
 * @param {number} o.ready        READY agents the engine may pace for
 * @param {number} [o.ratio]      campaigns.dial_ratio — lines per ready agent
 * @param {boolean} [o.overBudget] abandon rate is over the global cutoff
 * @returns {{target:number, ratio:number}}
 */
function ratioTarget({ ready, ratio, overBudget }) {
  const readyCount = Math.max(0, Math.floor(Number(ready) || 0));
  if (readyCount <= 0) return { target: 0, ratio: 0 };
  const configured = Math.max(1, Number(ratio) || 1);
  const effective = overBudget ? 1 : configured;
  return { target: Math.max(1, Math.floor(readyCount * effective)), ratio: effective };
}

module.exports = {
  MIN_ANSWER_RATE,
  GOVERNOR_SOFT_ZONE,
  predictiveTarget,
  ratioTarget,
};

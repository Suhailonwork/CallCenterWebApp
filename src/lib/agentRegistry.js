/* =====================================================================
 *  agentRegistry.js — the agent state machine the dialer paces against.
 *
 *      LOGOUT ──login──▶ PAUSE ──go available──▶ READY
 *                          ▲                      │
 *                          │                   call assigned
 *                   take a break                  ▼
 *                          │                    INCALL
 *                          │                      │
 *                          └────── WRAPUP ◀── call ended
 *                                    │
 *                            disposition saved
 *                                    ▼
 *                                  READY
 *
 *  The predictive engine may ONLY hand a connected customer to an agent in
 *  READY. An agent finishing a call lands in WRAPUP — never straight back in
 *  the ready pool — so the dialer cannot drop a new call on somebody who is
 *  still filling in the disposition form.
 *
 *  The Socket.IO payload keeps its original `state` field (idle / on-call /
 *  …) so the existing Live Agents widget renders unchanged, and adds
 *  `agentState` with the canonical value for the new dialer dashboard.
 * ===================================================================== */
"use strict";

const AGENT_STATE = Object.freeze({
  READY: "READY",
  INCALL: "INCALL",
  WRAPUP: "WRAPUP",
  PAUSE: "PAUSE",
  LOGOUT: "LOGOUT",
});

/** Canonical state -> the legacy value the existing UI already understands. */
const LEGACY_STATE = Object.freeze({
  READY: "idle",
  INCALL: "on-call",
  WRAPUP: "wrapup",
  PAUSE: "paused",
  LOGOUT: "offline",
});

function createAgentRegistry({ io, log }) {
  /**
   * userId -> {
   *   id, name, role, extension, campaignId,
   *   agentState, since, available,
   *   leadId, callId, gatewayId,        // set while INCALL
   *   pauseReason, wrapupSince
   * }
   */
  const agents = new Map();

  function emit() {
    if (io && typeof io.emit === "function") io.emit("agents-updated", snapshot());
  }

  function shape(a) {
    return {
      id: a.id,
      name: a.name,
      role: a.role,
      extension: a.extension,
      campaignId: a.campaignId,
      // legacy fields — the existing dashboard/dialer read these
      state: LEGACY_STATE[a.agentState] || "idle",
      available: a.agentState === AGENT_STATE.READY,
      // canonical fields
      agentState: a.agentState,
      since: a.since,
      leadId: a.leadId ?? null,
      callId: a.callId ?? null,
      pauseReason: a.pauseReason ?? null,
    };
  }

  function snapshot() {
    return [...agents.values()].map(shape);
  }

  function get(userId) {
    return agents.get(userId) || null;
  }

  function connect(user) {
    const existing = agents.get(user.id);
    if (existing) {
      existing.name = user.name;
      return existing;
    }
    const a = {
      id: user.id,
      name: user.name,
      role: user.role,
      extension: null,
      campaignId: null,
      // A freshly connected agent is NOT in the dialing pool until they press
      // "Go available" — that is exactly what PAUSE means here.
      agentState: AGENT_STATE.PAUSE,
      since: Date.now(),
      available: false,
      leadId: null,
      callId: null,
      gatewayId: null,
      pauseReason: "logged-in",
      wrapupSince: null,
    };
    agents.set(user.id, a);
    emit();
    return a;
  }

  function disconnect(userId) {
    const a = agents.get(userId);
    if (!a) return null;
    agents.delete(userId);
    emit();
    return a;
  }

  /**
   * Move an agent to a new state. Returns the agent, or null when unknown.
   * @param {number} userId
   * @param {string} next  one of AGENT_STATE
   * @param {object} [meta] {campaignId, extension, leadId, callId, gatewayId, reason}
   */
  function setState(userId, next, meta) {
    const a = agents.get(userId);
    if (!a) return null;
    const state = AGENT_STATE[next] ? next : null;
    if (!state) return a;
    const m = meta || {};

    if (m.extension) a.extension = String(m.extension);
    if (m.campaignId != null) a.campaignId = Number(m.campaignId) || null;

    if (a.agentState !== state) {
      const from = a.agentState;
      a.agentState = state;
      a.since = Date.now();
      if (log) {
        log.info("agent_state", {
          agent: a.id,
          from,
          to: state,
          campaign: a.campaignId,
          reason: m.reason,
        });
      }
    }

    switch (state) {
      case AGENT_STATE.INCALL:
        a.leadId = m.leadId ?? a.leadId;
        a.callId = m.callId ?? a.callId;
        a.gatewayId = m.gatewayId ?? a.gatewayId;
        a.wrapupSince = null;
        a.pauseReason = null;
        break;
      case AGENT_STATE.WRAPUP:
        a.wrapupSince = Date.now();
        a.pauseReason = null;
        break;
      case AGENT_STATE.READY:
        a.leadId = null;
        a.callId = null;
        a.gatewayId = null;
        a.wrapupSince = null;
        a.pauseReason = null;
        break;
      case AGENT_STATE.PAUSE:
        a.leadId = null;
        a.callId = null;
        a.gatewayId = null;
        a.wrapupSince = null;
        a.pauseReason = m.reason || "break";
        break;
      default:
        break;
    }
    a.available = a.agentState === AGENT_STATE.READY;
    emit();
    return a;
  }

  /**
   * Translate the legacy `set-state` socket event the existing Dialer sends.
   * The important rule lives here: a call ending puts the agent in WRAPUP, not
   * back in the ready pool — otherwise the engine would dial another customer
   * while the wrap-up form is still open.
   */
  function applyLegacyState(userId, raw) {
    const a = agents.get(userId);
    if (!a) return null;
    const s = String(raw || "").toLowerCase();
    if (s === "on-call") return setState(userId, AGENT_STATE.INCALL, { reason: "browser" });
    if (s === "idle" || s === "online") {
      if (a.agentState === AGENT_STATE.INCALL) {
        return setState(userId, AGENT_STATE.WRAPUP, { reason: "call-ended" });
      }
      return a; // PAUSE / WRAPUP / READY are owned by explicit events
    }
    return a;
  }

  /** Agents a campaign can currently be paced against. */
  function readyFor(campaignId) {
    const out = [];
    for (const a of agents.values()) {
      if (a.role !== "employee") continue;
      if (a.agentState !== AGENT_STATE.READY) continue;
      if (!a.campaignId || !a.extension) continue;
      if (campaignId != null && a.campaignId !== campaignId) continue;
      out.push(a);
    }
    // Longest-waiting agent first — even call distribution across the team.
    out.sort((x, y) => x.since - y.since);
    return out;
  }

  /** Everyone signed on to a campaign, whatever their state. */
  function staffedFor(campaignId) {
    const out = [];
    for (const a of agents.values()) {
      if (a.role !== "employee") continue;
      if (!a.campaignId || !a.extension) continue;
      if (campaignId != null && a.campaignId !== campaignId) continue;
      out.push(a);
    }
    return out;
  }

  /** Campaign ids that currently have at least one signed-on agent. */
  function activeCampaignIds() {
    const ids = new Set();
    for (const a of agents.values()) {
      if (a.role !== "employee") continue;
      if (a.campaignId && a.extension) ids.add(a.campaignId);
    }
    return [...ids];
  }

  function countsFor(campaignId) {
    const c = { ready: 0, incall: 0, wrapup: 0, pause: 0, staffed: 0 };
    for (const a of staffedFor(campaignId)) {
      c.staffed++;
      if (a.agentState === AGENT_STATE.READY) c.ready++;
      else if (a.agentState === AGENT_STATE.INCALL) c.incall++;
      else if (a.agentState === AGENT_STATE.WRAPUP) c.wrapup++;
      else if (a.agentState === AGENT_STATE.PAUSE) c.pause++;
    }
    return c;
  }

  /**
   * Agents stuck in a state because the browser missed an event.
   * INCALL beyond onCallTimeoutSec or WRAPUP beyond wrapupTimeoutSec are
   * recovered so the seat does not stay dark forever.
   * @returns {{id:number, from:string, ageSec:number}[]}
   */
  function sweep({ onCallTimeoutSec, wrapupTimeoutSec }) {
    const now = Date.now();
    const recovered = [];
    for (const a of agents.values()) {
      if (a.agentState === AGENT_STATE.INCALL) {
        const age = (now - a.since) / 1000;
        if (age > (onCallTimeoutSec || 1800)) {
          recovered.push({ id: a.id, from: AGENT_STATE.INCALL, ageSec: Math.round(age) });
          setState(a.id, AGENT_STATE.WRAPUP, { reason: "oncall-timeout" });
        }
      } else if (a.agentState === AGENT_STATE.WRAPUP) {
        const age = (now - (a.wrapupSince || a.since)) / 1000;
        if (age > (wrapupTimeoutSec || 900)) {
          recovered.push({ id: a.id, from: AGENT_STATE.WRAPUP, ageSec: Math.round(age) });
          setState(a.id, AGENT_STATE.PAUSE, { reason: "wrapup-timeout" });
        }
      }
    }
    return recovered;
  }

  return {
    AGENT_STATE,
    agents,
    get,
    connect,
    disconnect,
    setState,
    applyLegacyState,
    readyFor,
    staffedFor,
    activeCampaignIds,
    countsFor,
    sweep,
    snapshot,
    emit,
  };
}

module.exports = { createAgentRegistry, AGENT_STATE, LEGACY_STATE };

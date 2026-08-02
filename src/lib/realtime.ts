// Server-side helpers to reach the live parts of the process: the Socket.io
// server and the predictive dialer engine, both attached to globalThis by
// server.mjs. Every helper is a no-op when the route runs outside that process
// (e.g. `next build`), so nothing here can ever break a request.

/** Tell every connected client that data in a given scope changed. */
export function broadcastChange(scope: 'calls' | 'breaks' | 'dialer') {
  const io = (globalThis as any).__ccio;
  if (io && typeof io.emit === 'function') {
    io.emit('data-changed', { scope });
  }
}

function engine(): any {
  return (globalThis as any).__ccEngine ?? null;
}

/**
 * Nudge the predictive engine to run a dial cycle immediately instead of
 * waiting for its next timer tick, dropping its campaign/gateway caches first.
 * Campaign dial rules are read fresh on every claim, so a kick makes a rules
 * change take effect within milliseconds. Returns true if the engine was
 * kicked.
 */
export function kickDialer(): boolean {
  const e = engine();
  if (e && typeof e.kick === 'function') {
    try {
      e.kick();
      return true;
    } catch {
      /* a failed kick must never break the request */
    }
  }
  return false;
}

/**
 * Return an agent to READY the moment they save a wrap-up, instead of waiting
 * for the wrap-up timeout. Returns true if the engine handled it.
 */
export function agentWrapupDone(agentId: number): boolean {
  const e = engine();
  if (e && typeof e.agentWrapupDone === 'function') {
    try {
      e.agentWrapupDone(agentId);
      return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

export interface DialerSnapshot {
  enabled: boolean;
  ariConnected: boolean;
  tickMs: number;
  calls: {
    attemptId: string;
    campaignId: number;
    leadId: number;
    callId: number | null;
    phone: string;
    contactName: string | null;
    gatewayId: number | null;
    agentId: number | null;
    state: string;
    source: string;
    ageSec: number;
  }[];
  campaigns: {
    campaignId: number;
    answered: number;
    abandoned: number;
    abandonPct: number;
    live: number;
    ready: number;
    incall: number;
    wrapup: number;
    pause: number;
    staffed: number;
  }[];
  gateways: {
    gatewayId: number;
    inUse: number;
    reachable: boolean;
    state: string;
    failures: number;
    cooldownMsLeft: number;
  }[];
  agents: {
    id: number;
    name: string;
    extension: string | null;
    campaignId: number | null;
    state: string;
    agentState: string;
    since: number;
    leadId: number | null;
    callId: number | null;
    pauseReason: string | null;
  }[];
}

/** Live in-memory dialer state, or null when the engine is not in this process. */
export function dialerSnapshot(): DialerSnapshot | null {
  const e = engine();
  if (e && typeof e.snapshot === 'function') {
    try {
      return e.snapshot() as DialerSnapshot;
    } catch {
      return null;
    }
  }
  return null;
}

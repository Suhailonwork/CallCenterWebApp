'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Events that describe the current state rather than a change: the server
 * sends them on connect and then only when something moves. A component that
 * mounts later (client-side navigation) would otherwise render nothing until
 * the next change, so the last payload is kept and replayed to it.
 */
const STICKY_EVENTS = new Set(['agents-updated']);
const lastPayload = new Map<string, unknown>();

/** Shared Socket.io connection to the app's own origin. */
export function getSocket(): Socket {
  if (!socket) {
    const s = io({ path: '/socket.io' });
    STICKY_EVENTS.forEach((event) => {
      s.on(event, (payload: unknown) => lastPayload.set(event, payload));
    });
    socket = s;
  }
  return socket;
}

/**
 * Drop the shared connection. The server identifies a socket by the session
 * cookie it connected with, so after sign-out the next user must get a fresh
 * connection instead of inheriting the previous user's identity.
 */
export function resetSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  lastPayload.clear();
}

/** Subscribe a component to a Socket.io event for its lifetime. */
export function useSocketEvent(event: string, handler: (payload: any) => void) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const s = getSocket();
    const fn = (payload: any) => ref.current(payload);
    s.on(event, fn);
    if (STICKY_EVENTS.has(event) && lastPayload.has(event)) {
      fn(lastPayload.get(event));
    }
    return () => {
      s.off(event, fn);
    };
  }, [event]);
}

'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Shared Socket.io connection to the app's own origin. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: '/socket.io' });
  }
  return socket;
}

/** Subscribe a component to a Socket.io event for its lifetime. */
export function useSocketEvent(event: string, handler: (payload: any) => void) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const s = getSocket();
    const fn = (payload: any) => ref.current(payload);
    s.on(event, fn);
    return () => {
      s.off(event, fn);
    };
  }, [event]);
}

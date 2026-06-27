'use client';

import { useEffect } from 'react';

/**
 * Invisible keep-alive: pings the attendance heartbeat endpoint on an
 * interval (and once on mount) so the live "online" status stays accurate
 * and stale sessions can be detected. Renders nothing.
 */
export function AttendanceHeartbeat({ intervalMs = 60_000 }: { intervalMs?: number }) {
  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      if (cancelled) return;
      // Best-effort; keepalive lets the final ping survive a tab close.
      fetch('/api/attendance/heartbeat', { method: 'POST', keepalive: true }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return null;
}

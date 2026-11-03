'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSocketEvent } from '@/lib/useSocket';

/** Changes arriving within this window are folded into a single refresh. */
const REFRESH_COALESCE_MS = 1000;

/**
 * Invisible helper: re-renders the current server route when relevant
 * data changes elsewhere in the system. Drop it into any layout/page.
 *
 * Every wrap-up on the floor broadcasts a change, so on a busy shift they
 * arrive in bursts. The first one refreshes straight away; the rest of a burst
 * collapse into one trailing refresh instead of one server render each.
 */
export function LiveRefresh({ scopes }: { scopes: string[] }) {
  const router = useRouter();
  const lastRefreshAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useSocketEvent('data-changed', (p: { scope?: string }) => {
    if (p?.scope && !scopes.includes(p.scope)) return;

    const wait = REFRESH_COALESCE_MS - (Date.now() - lastRefreshAt.current);
    if (wait <= 0) {
      lastRefreshAt.current = Date.now();
      router.refresh();
      return;
    }
    if (timer.current) return; // a trailing refresh is already scheduled
    timer.current = setTimeout(() => {
      timer.current = null;
      lastRefreshAt.current = Date.now();
      router.refresh();
    }, wait);
  });

  return null;
}

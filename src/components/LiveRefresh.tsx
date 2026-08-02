'use client';

import { useRouter } from 'next/navigation';
import { useSocketEvent } from '@/lib/useSocket';

/**
 * Invisible helper: re-renders the current server route when relevant
 * data changes elsewhere in the system. Drop it into any layout/page.
 */
export function LiveRefresh({ scopes }: { scopes: string[] }) {
  const router = useRouter();

  useSocketEvent('data-changed', (p: { scope?: string }) => {
    if (!p?.scope || scopes.includes(p.scope)) {
      router.refresh();
    }
  });

  return null;
}

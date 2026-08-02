import { authenticate, isError, ok } from '@/lib/api';
import { touchSession } from '@/lib/attendance';

export const runtime = 'nodejs';

/**
 * POST /api/attendance/heartbeat — keep-alive ping from the client shell.
 * Bumps last_seen on the caller's open attendance session so the live
 * "online" status stays accurate and stale sessions can be swept later.
 * Available to any authenticated role.
 */
export async function POST() {
  const u = await authenticate();
  if (isError(u)) return u;
  await touchSession(u.id);
  return ok({ ok: true });
}

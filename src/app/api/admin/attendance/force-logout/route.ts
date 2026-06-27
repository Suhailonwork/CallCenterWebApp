import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { queryOne } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { recordLogout } from '@/lib/attendance';

export const runtime = 'nodejs';

const schema = z.object({ userId: z.number().int().positive() });

/**
 * POST /api/admin/attendance/force-logout — admin force-closes a user's open
 * attendance session (e.g. a forgotten / stuck session). This records the
 * forced logout in attendance + audit; it does not invalidate the user's JWT.
 */
export async function POST(req: Request) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid payload');

  const open = await queryOne<{ id: number }>(
    'SELECT id FROM attendance_sessions WHERE user_id = ? AND logout_at IS NULL LIMIT 1',
    [parsed.data.userId],
  );
  if (!open) return fail('User has no open session', 404);

  await recordLogout(parsed.data.userId, 'force');
  await logAudit({
    userId: u.id,
    action: 'force_logout',
    entity: 'attendance_sessions',
    entityId: open.id,
    details: { targetUserId: parsed.data.userId },
  });
  return ok({ ok: true });
}

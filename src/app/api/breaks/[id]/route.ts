import { authenticate, isError, ok, fail } from '@/lib/api';
import { query, queryOne } from '@/lib/db';
import { employeesUnderManager, employeesUnderTL } from '@/lib/org';
import { broadcastChange } from '@/lib/realtime';

export const runtime = 'nodejs';

/** PATCH /api/breaks/:id - approve / deny / end a break. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate();
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return fail('Invalid break id');

  const brk = await queryOne<{ id: number; employee_id: number; status: string }>(
    'SELECT id, employee_id, status FROM breaks WHERE id = ?',
    [id],
  );
  if (!brk) return fail('Break not found', 404);

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  // Employee ends their own active break.
  if (action === 'end') {
    if (u.role === 'employee' && brk.employee_id !== u.id) {
      return fail('Forbidden', 403);
    }
    if (brk.status !== 'active') return fail('Break is not active');
    await query(
      "UPDATE breaks SET status = 'completed', end_time = NOW() WHERE id = ?",
      [id],
    );
    broadcastChange('breaks');
    return ok({ ok: true });
  }

  // Manager / TL approve or deny a requested break.
  if (action === 'approve' || action === 'deny') {
    if (u.role !== 'manager' && u.role !== 'tl') return fail('Forbidden', 403);

    const team =
      u.role === 'manager'
        ? await employeesUnderManager(u.id)
        : await employeesUnderTL(u.id);
    if (!team.some((e) => e.id === brk.employee_id)) {
      return fail('Not a member of your team', 403);
    }
    if (brk.status !== 'requested') return fail('Break is not pending');

    if (action === 'approve') {
      await query(
        "UPDATE breaks SET status = 'active', start_time = NOW(), approved_by = ? WHERE id = ?",
        [u.id, id],
      );
    } else {
      await query(
        "UPDATE breaks SET status = 'denied', approved_by = ? WHERE id = ?",
        [u.id, id],
      );
    }
    broadcastChange('breaks');
    return ok({ ok: true });
  }

  return fail('Invalid action');
}

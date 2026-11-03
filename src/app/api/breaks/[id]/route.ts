import { authenticate, isError, ok, fail } from '@/lib/api';
import { query, queryOne } from '@/lib/db';
import { employeesUnderManager } from '@/lib/org';
import { tlTeam } from '@/lib/groups';
import { broadcastChange } from '@/lib/realtime';

export const runtime = 'nodejs';

/** Is this employee someone the calling manager / TL is responsible for? */
async function inCallersTeam(u: { id: number; role: string }, employeeId: number) {
  const team =
    u.role === 'manager'
      ? await employeesUnderManager(u.id)
      : await tlTeam(u.id); // reports_to + group agents
  return team.some((e) => e.id === employeeId);
}

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

  // Employee ends their own active break; a manager / TL ends one for somebody
  // on their own team.
  if (action === 'end') {
    if (u.role === 'employee' && brk.employee_id !== u.id) {
      return fail('Forbidden', 403);
    }
    if ((u.role === 'manager' || u.role === 'tl') && !(await inCallersTeam(u, brk.employee_id))) {
      return fail('Not a member of your team', 403);
    }
    if (brk.status !== 'active') return fail('Break is not active');
    // Conditional on the status, so a double click (or two people ending the
    // same break) cannot overwrite the end time that was already recorded.
    const res = (await query(
      "UPDATE breaks SET status = 'completed', end_time = NOW() WHERE id = ? AND status = 'active'",
      [id],
    )) as unknown as { affectedRows?: number };
    if (!res.affectedRows) return fail('Break is not active');
    broadcastChange('breaks');
    return ok({ ok: true });
  }

  // Manager / TL approve or deny a requested break.
  if (action === 'approve' || action === 'deny') {
    if (u.role !== 'manager' && u.role !== 'tl') return fail('Forbidden', 403);

    if (!(await inCallersTeam(u, brk.employee_id))) {
      return fail('Not a member of your team', 403);
    }
    if (brk.status !== 'requested') return fail('Break is not pending');

    // Conditional on the status: two approvers acting at once (or a double
    // click) must not both win — the later one is told it is no longer pending.
    const res = (await query(
      action === 'approve'
        ? "UPDATE breaks SET status = 'active', start_time = NOW(), approved_by = ? WHERE id = ? AND status = 'requested'"
        : "UPDATE breaks SET status = 'denied', approved_by = ? WHERE id = ? AND status = 'requested'",
      [u.id, id],
    )) as unknown as { affectedRows?: number };
    if (!res.affectedRows) return fail('Break is not pending');
    broadcastChange('breaks');
    return ok({ ok: true });
  }

  return fail('Invalid action');
}

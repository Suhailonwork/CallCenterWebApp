import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { query, queryOne } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { hashPassword } from '@/lib/password';

export const runtime = 'nodejs';

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  teamId: z.number().int().positive().nullable().optional(),
  shiftId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(100).optional(),
});

/** PATCH /api/admin/users/:id - edit name / team / status / password. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return fail('Invalid user id');

  const target = await queryOne<{ id: number; role: string }>(
    'SELECT id, role FROM users WHERE id = ?',
    [id],
  );
  if (!target) return fail('User not found', 404);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid data');
  const d = parsed.data;

  // Same rule as DELETE: an admin who locks themselves out leaves nobody able
  // to undo it.
  if (id === u.id && d.isActive === false) {
    return fail('You cannot deactivate your own account');
  }

  const sets: string[] = [];
  const vals: any[] = [];
  if (d.name !== undefined) {
    sets.push('name = ?');
    vals.push(d.name);
  }
  if (d.isActive !== undefined) {
    sets.push('is_active = ?');
    vals.push(d.isActive ? 1 : 0);
  }
  if (d.password) {
    sets.push('password_hash = ?');
    vals.push(await hashPassword(d.password));
  }
  if (d.shiftId !== undefined) {
    // A stale id would otherwise surface as a foreign-key 500.
    if (d.shiftId && !(await queryOne('SELECT id FROM shifts WHERE id = ?', [d.shiftId]))) {
      return fail('Selected shift not found');
    }
    sets.push('shift_id = ?');
    vals.push(d.shiftId);
  }
  if (d.teamId !== undefined) {
    let reportsTo: number | null = null;
    if (d.teamId) {
      const team = await queryOne<{ manager_id: number | null; tl_id: number | null }>(
        'SELECT manager_id, tl_id FROM teams WHERE id = ?',
        [d.teamId],
      );
      if (!team) return fail('Selected team not found');
      if (target.role === 'employee' || target.role === 'tl') {
        reportsTo = target.role === 'employee' ? team.tl_id : team.manager_id;
      }
    }
    sets.push('team_id = ?');
    vals.push(d.teamId);
    sets.push('reports_to = ?');
    vals.push(reportsTo);
  }

  if (sets.length === 0) return fail('Nothing to update');
  vals.push(id);
  await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
  await logAudit({ userId: u.id, action: 'update_user', entity: 'users', entityId: id });
  return ok({ ok: true });
}

/** DELETE /api/admin/users/:id - deactivate (soft delete) an account. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return fail('Invalid user id');
  if (id === u.id) return fail('You cannot deactivate your own account');

  await query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
  await logAudit({ userId: u.id, action: 'deactivate_user', entity: 'users', entityId: id });
  return ok({ ok: true });
}

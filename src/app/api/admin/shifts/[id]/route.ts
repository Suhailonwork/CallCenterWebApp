import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { query, queryOne } from '@/lib/db';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  start_time: z.string().regex(TIME_RE, 'Use HH:MM').optional(),
  end_time: z.string().regex(TIME_RE, 'Use HH:MM').optional(),
  grace_minutes: z.number().int().min(0).max(240).optional(),
  working_hours: z.number().min(0).max(24).nullable().optional(),
  is_active: z.boolean().optional(),
});

/** PATCH /api/admin/shifts/:id — edit a shift (incl. activate / deactivate). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return fail('Invalid shift id');
  if (!(await queryOne('SELECT id FROM shifts WHERE id = ?', [id]))) return fail('Shift not found', 404);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid data');
  const d = parsed.data;

  const sets: string[] = [];
  const vals: unknown[] = [];
  if (d.name !== undefined) { sets.push('name = ?'); vals.push(d.name); }
  if (d.start_time !== undefined) { sets.push('start_time = ?'); vals.push(d.start_time); }
  if (d.end_time !== undefined) { sets.push('end_time = ?'); vals.push(d.end_time); }
  if (d.grace_minutes !== undefined) { sets.push('grace_minutes = ?'); vals.push(d.grace_minutes); }
  if (d.working_hours !== undefined) { sets.push('working_hours = ?'); vals.push(d.working_hours); }
  if (d.is_active !== undefined) { sets.push('is_active = ?'); vals.push(d.is_active ? 1 : 0); }

  if (sets.length === 0) return fail('Nothing to update');
  vals.push(id);
  await query(`UPDATE shifts SET ${sets.join(', ')} WHERE id = ?`, vals);
  await logAudit({ userId: u.id, action: 'update_shift', entity: 'shifts', entityId: id, details: { fields: Object.keys(d) } });
  return ok({ ok: true });
}

/** DELETE /api/admin/shifts/:id — deactivate a shift (history is preserved). */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return fail('Invalid shift id');

  await query('UPDATE shifts SET is_active = 0 WHERE id = ?', [id]);
  await logAudit({ userId: u.id, action: 'deactivate_shift', entity: 'shifts', entityId: id });
  return ok({ ok: true });
}

import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool } from '@/lib/db';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const patchSchema = z.object({
  name:    z.string().min(1).max(120).optional(),
  columns: z.array(z.string().trim().min(1).max(120)).min(1).max(100).optional(),
});

/** PATCH /api/admin/data-tables/[id] — update a data table */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isFinite(id)) return fail('Invalid id');

  try {
    const [rows]: any = await pool.execute('SELECT id FROM data_tables WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return fail('Data table not found', 404);

    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail('Invalid data');
    const d = parsed.data;

    const sets: string[] = [];
    const vals: any[]    = [];

    if (d.name    !== undefined) { sets.push('name=?');    vals.push(d.name); }
    if (d.columns !== undefined) { sets.push('columns=?'); vals.push(JSON.stringify(d.columns)); }

    if (sets.length === 0) return fail('No fields to update');

    vals.push(id);
    await pool.execute(`UPDATE data_tables SET ${sets.join(', ')} WHERE id = ?`, vals);

    await logAudit({
      userId: u.id,
      action: 'update_data_table',
      entity: 'data_tables',
      entityId: id,
      details: { name: d.name, columns: d.columns },
    });

    return ok({ ok: true });
  } catch (e: any) {
    console.error('[data-tables PATCH]', e);
    return fail('Update failed', 500);
  }
}

/** DELETE /api/admin/data-tables/[id] — remove a data table */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isFinite(id)) return fail('Invalid id');

  try {
    await pool.execute('DELETE FROM data_tables WHERE id = ?', [id]);
    await logAudit({ userId: u.id, action: 'delete_data_table', entity: 'data_tables', entityId: id });
    return ok({ ok: true });
  } catch (e: any) {
    console.error('[data-tables DELETE]', e);
    return fail('Delete failed', 500);
  }
}

import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool, queryOne } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { getList, fieldsSchema, normalizeFields } from '@/lib/lists';

export const runtime = 'nodejs';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().max(500).nullable().optional(),
  campaign_id: z.number().int().positive().optional(),
  active: z.enum(['Y', 'N']).optional(),
  fields: fieldsSchema.nullable().optional(),
});

/**
 * PATCH /api/admin/lists/:id — modify a list: rename, toggle active,
 * edit custom fields, or move it to another campaign. Moving re-homes the
 * list's leads (csv_data.campaign_id is denormalized for the claim hot
 * path, so it is updated in the same transaction).
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const listId = Number(params.id);
  if (!Number.isInteger(listId) || listId <= 0) return fail('Invalid list id');
  const list = await getList(listId);
  if (!list) return fail('List not found', 404);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid list update');
  const d = parsed.data;

  if (d.campaign_id != null && d.campaign_id !== list.campaign_id) {
    const target = await queryOne('SELECT id FROM campaigns WHERE id = ?', [d.campaign_id]);
    if (!target) return fail('Target campaign not found', 404);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (d.name !== undefined) {
      await conn.execute('UPDATE lists SET name = ? WHERE id = ?', [d.name, listId]);
    }
    if (d.description !== undefined) {
      await conn.execute('UPDATE lists SET description = ? WHERE id = ?', [d.description, listId]);
    }
    if (d.active !== undefined) {
      await conn.execute('UPDATE lists SET active = ? WHERE id = ?', [d.active, listId]);
    }
    if (d.fields !== undefined) {
      const fields = normalizeFields(d.fields);
      await conn.execute('UPDATE lists SET fields = ? WHERE id = ?', [
        fields ? JSON.stringify(fields) : null,
        listId,
      ]);
    }
    if (d.campaign_id !== undefined && d.campaign_id !== list.campaign_id) {
      // Re-home the list AND its leads to the new campaign.
      await conn.execute('UPDATE lists SET campaign_id = ? WHERE id = ?', [d.campaign_id, listId]);
      await conn.execute('UPDATE csv_data SET campaign_id = ? WHERE list_id = ?', [
        d.campaign_id,
        listId,
      ]);
    }
    await logAudit(
      {
        userId: u.id,
        action: 'update_list',
        entity: 'lists',
        entityId: listId,
        details: { ...d, previousCampaignId: list.campaign_id },
      },
      conn,
    );
    await conn.commit();
    return ok({ updated: true });
  } catch (e) {
    await conn.rollback();
    console.error('[admin/lists PATCH]', e);
    return fail('Failed to update list', 500);
  } finally {
    conn.release();
  }
}

/**
 * DELETE /api/admin/lists/:id — deletes the list and its leads. The leads go
 * via the ON DELETE CASCADE on csv_data.fk_csv_list; call history survives
 * (calls.csv_data_id is ON DELETE SET NULL). The lead count is returned so
 * the UI can confirm what was removed.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const listId = Number(params.id);
  if (!Number.isInteger(listId) || listId <= 0) return fail('Invalid list id');
  const list = await getList(listId);
  if (!list) return fail('List not found', 404);

  const count = await queryOne<{ n: number }>(
    'SELECT COUNT(*) AS n FROM csv_data WHERE list_id = ?',
    [listId],
  );
  const leadCount = Number(count?.n ?? 0);

  await pool.execute('DELETE FROM lists WHERE id = ?', [listId]);
  await logAudit({
    userId: u.id,
    action: 'delete_list',
    entity: 'lists',
    entityId: listId,
    details: { name: list.name, campaignId: list.campaign_id, deletedLeads: leadCount },
  });
  return ok({ deleted: true, deletedLeads: leadCount });
}

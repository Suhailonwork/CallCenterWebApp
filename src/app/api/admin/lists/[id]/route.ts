import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool, queryOne } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { getList } from '@/lib/lists';

export const runtime = 'nodejs';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().max(500).nullable().optional(),
  campaign_id: z.number().int().positive().optional(),
  active: z.enum(['Y', 'N']).optional(),
  template_id: z.number().int().positive().nullable().optional(),
});

/**
 * PATCH /api/admin/lists/:id — modify a list: rename, toggle active,
 * change template, or move it to another campaign. Moving re-homes the
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
  if (d.template_id != null) {
    const dt = await queryOne('SELECT id FROM data_tables WHERE id = ?', [d.template_id]);
    if (!dt) return fail('Data template not found', 404);
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
    if (d.template_id !== undefined) {
      await conn.execute('UPDATE lists SET template_id = ? WHERE id = ?', [d.template_id, listId]);
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

/** DELETE /api/admin/lists/:id — only allowed when the list has no leads. */
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
  if (Number(count?.n ?? 0) > 0) {
    return fail(`List still holds ${count!.n} leads — move or delete them first`, 409);
  }

  await pool.execute('DELETE FROM lists WHERE id = ?', [listId]);
  await logAudit({
    userId: u.id,
    action: 'delete_list',
    entity: 'lists',
    entityId: listId,
    details: { name: list.name, campaignId: list.campaign_id },
  });
  return ok({ deleted: true });
}

import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool, queryOne } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { getList } from '@/lib/lists';
import { parseDialStatuses } from '@/lib/dialEligibility';

export const runtime = 'nodejs';

/**
 * A list RESET makes every lead fresh again (called_since_last_reset='N')
 * WITHOUT touching statuses — VICIdial semantics. Whether a lead is then
 * dialable still depends on its status being in campaign.dial_statuses.
 */
async function resetPreview(listId: number, campaignId: number) {
  const camp = await queryOne<{ dial_statuses: unknown }>(
    'SELECT dial_statuses FROM campaigns WHERE id = ?',
    [campaignId],
  );
  const dialStatuses = parseDialStatuses(camp?.dial_statuses);
  const totals = await queryOne<{ total: number; called: number }>(
    'SELECT COUNT(*) AS total, COALESCE(SUM(called = 1), 0) AS called FROM csv_data WHERE list_id = ?',
    [listId],
  );
  let dialableAfter = 0;
  if (dialStatuses.length > 0) {
    const r = await queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM csv_data
        WHERE list_id = ? AND call_status IN (${dialStatuses.map(() => '?').join(',')})`,
      [listId, ...dialStatuses],
    );
    dialableAfter = Number(r?.n ?? 0);
  }
  return {
    totalLeads: Number(totals?.total ?? 0),
    resetCount: Number(totals?.called ?? 0), // leads whose flag flips back to fresh
    dialableAfter, // leads claimable after the reset (status in dial_statuses)
    dialStatuses,
  };
}

/** GET /api/admin/lists/:id/reset — dry-run numbers for the confirm dialog. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const listId = Number(params.id);
  if (!Number.isInteger(listId) || listId <= 0) return fail('Invalid list id');
  const list = await getList(listId);
  if (!list) return fail('List not found', 404);

  return ok(await resetPreview(listId, list.campaign_id));
}

/**
 * POST /api/admin/lists/:id/reset — perform the reset:
 * called=0 + recycle_attempts=0 for every lead in the list; statuses,
 * call_count and last_call_at stay untouched.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const listId = Number(params.id);
  if (!Number.isInteger(listId) || listId <= 0) return fail('Invalid list id');
  const list = await getList(listId);
  if (!list) return fail('List not found', 404);

  const preview = await resetPreview(listId, list.campaign_id);
  await pool.execute(
    'UPDATE csv_data SET called = 0, recycle_attempts = 0 WHERE list_id = ?',
    [listId],
  );
  await logAudit({
    userId: u.id,
    action: 'reset_list',
    entity: 'lists',
    entityId: listId,
    details: { name: list.name, resetCount: preview.resetCount, dialableAfter: preview.dialableAfter },
  });
  return ok(preview);
}

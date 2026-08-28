import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool, queryOne } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { getList } from '@/lib/lists';
import { parseDialStatuses } from '@/lib/dialEligibility';
import { IN_FLIGHT_STATUSES } from '@/lib/leadStatus';
import { kickDialer } from '@/lib/realtime';

export const runtime = 'nodejs';

/**
 * A list RESET makes every lead fresh again (called_since_last_reset = 'N')
 * WITHOUT touching statuses — VICIdial semantics. Whether a lead then dials
 * still depends on its status being in campaign.dial_statuses.
 *
 * The reset also clears the redial queue for those leads (next_retry_at and
 * recycle_attempts), so a re-run starts immediately instead of waiting out a
 * retry timer left over from the previous pass.
 *
 * Leads that are mid-call are skipped entirely: a lead in QUEUED / DIALING /
 * RINGING / CONNECTED with a live claim has a call on the line right now, and
 * resetting it would let the dialer ring a customer who is already talking to
 * an agent.
 */
const LIVE_CLAIM_SEC = 120; // matches the engine's dialer_claim_timeout_sec default

const IN_FLIGHT_LIST = IN_FLIGHT_STATUSES.map((s) => `'${s}'`).join(',');

const NOT_LIVE =
  `(claimed_at IS NULL OR claimed_at < DATE_SUB(NOW(), INTERVAL ${LIVE_CLAIM_SEC} SECOND))` +
  ` AND call_status NOT IN (${IN_FLIGHT_LIST})`;

async function resetPreview(listId: number, campaignId: number) {
  const camp = await queryOne<{ dial_statuses: unknown }>(
    'SELECT dial_statuses FROM campaigns WHERE id = ?',
    [campaignId],
  );
  const dialStatuses = parseDialStatuses(camp?.dial_statuses);
  const totals = await queryOne<{ total: number; called: number; pending: number }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(called = 1 AND ${NOT_LIVE}), 0)                AS called,
            COALESCE(SUM(next_retry_at IS NOT NULL AND ${NOT_LIVE}), 0) AS pending
       FROM csv_data WHERE list_id = ?`,
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
    pendingRetries: Number(totals?.pending ?? 0), // redial timers that will be cleared
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
 * POST /api/admin/lists/:id/reset — perform the reset.
 *
 * Every "since the last reset" counter goes back to zero — called,
 * call_count, recycle_attempts, next_retry_at — and any stale claim is
 * dropped. Statuses and last_call_at are left alone.
 *
 * last_disposition is cleared too: a disposition that closes a lead (PAID,
 * Wrong Number, Legal Notice) keeps the claim query from ever offering it
 * again, so leaving it would make the reset a lie for exactly those leads.
 *
 * call_count is zeroed on purpose: it is what the campaign's "max attempts per
 * lead" cap is measured against, so leaving it would let a lead pass the reset
 * and still be refused by the cap — a reset that silently does nothing. The
 * permanent record of every attempt ever made lives in `calls`, which this
 * never touches.
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
    `UPDATE csv_data
        SET called           = 0,
            call_count       = 0,
            recycle_attempts = 0,
            next_retry_at    = NULL,
            completed_at     = NULL,
            pre_dial_status  = NULL,
            last_disposition = NULL,
            assigned_to      = NULL,
            claimed_at       = NULL
      WHERE list_id = ? AND ${NOT_LIVE}`,
    [listId],
  );
  await logAudit({
    userId: u.id,
    action: 'reset_list',
    entity: 'lists',
    entityId: listId,
    details: {
      name: list.name,
      resetCount: preview.resetCount,
      pendingRetries: preview.pendingRetries,
      dialableAfter: preview.dialableAfter,
    },
  });
  // Leads became dialable this instant — start on them without waiting a tick.
  kickDialer();
  return ok(preview);
}

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
 *
 * "Live" needs BOTH halves. An in-flight status on its own is not proof of a
 * call — every transition into one writes claimed_at in the same statement, so
 * an in-flight lead whose claim is expired or missing is a crash leftover, not
 * a conversation. Skipping those made a RESET silently do nothing for them,
 * which is the one action an operator has left once a lead is stuck on QUEUED.
 */
const LIVE_CLAIM_SEC = 120; // matches the engine's dialer_claim_timeout_sec default

const IN_FLIGHT_LIST = IN_FLIGHT_STATUSES.map((s) => `'${s}'`).join(',');

const NOT_LIVE =
  `NOT (call_status IN (${IN_FLIGHT_LIST})` +
  ` AND claimed_at IS NOT NULL` +
  ` AND claimed_at >= DATE_SUB(NOW(), INTERVAL ${LIVE_CLAIM_SEC} SECOND))`;

/**
 * The status a lead will REST on after the reset. In-flight leftovers (a crash
 * mid-dial) roll back to whatever they held before they were offered, exactly
 * as the engine's recovery sweep would — so the preview's `dialableAfter` is
 * the number the dialer will really see, not the one it sees right now.
 */
const STATUS_AFTER_RESET =
  `(CASE WHEN call_status IN (${IN_FLIGHT_LIST})` +
  ` THEN COALESCE(pre_dial_status, 'NEW') ELSE call_status END)`;

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
        WHERE list_id = ? AND ${NOT_LIVE}
          AND ${STATUS_AFTER_RESET} IN (${dialStatuses.map(() => '?').join(',')})`,
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
 * dropped. Statuses and last_call_at are left alone, with ONE exception: a
 * lead stranded on an in-flight status with no live claim is rolled back to
 * the status it held before it was offered. That is not a status change the
 * operator made — it is finishing the crash recovery the engine's sweep would
 * have done, and without it the lead would come out of the reset still sitting
 * on QUEUED, which nothing dials.
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
  // Assignment ORDER matters: MySQL evaluates an UPDATE's assignments left to
  // right and later ones see the values earlier ones wrote. status_changed_at
  // must therefore read call_status before call_status is reassigned, and
  // call_status must read pre_dial_status before it is cleared.
  await pool.execute(
    `UPDATE csv_data
        SET status_changed_at = IF(call_status IN (${IN_FLIGHT_LIST}), NOW(), status_changed_at),
            call_status       = ${STATUS_AFTER_RESET},
            pre_dial_status   = NULL,
            called            = 0,
            call_count        = 0,
            recycle_attempts  = 0,
            next_retry_at     = NULL,
            completed_at      = NULL,
            last_disposition  = NULL,
            assigned_to       = NULL,
            claimed_at        = NULL
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

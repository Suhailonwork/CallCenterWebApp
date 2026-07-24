import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool, query } from '@/lib/db';
import { agentCanAccessCampaign } from '@/lib/groups';
import {
  parseDialStatuses,
  parseRecycleRules,
  buildClaimSelect,
} from '@/lib/dialEligibility';

export const runtime = 'nodejs';

// A claimed-but-never-dialed contact is re-offered after this many seconds
// (covers an agent who closed the tab before placing the call).
const CLAIM_TIMEOUT_SEC = 120;

/**
 * GET /api/employee/dialer/next?campaignId=N
 * Returns the next dialable lead (FIFO) and atomically *claims* it inside a
 * transaction (SELECT ... FOR UPDATE), so two agents on the same campaign can
 * never be handed the same lead.
 *
 * Eligibility is VICIdial-style and IDENTICAL to the predictive engine's
 * claim (shared builder in src/lib/dialEligibility.js): the lead must sit in
 * an ACTIVE list and either be fresh (called=0 + status in dial_statuses) or
 * match one of the campaign's recycle rules.
 */
export async function GET(req: Request) {
  const user = await authenticate(['employee']);
  if (isError(user)) return user;

  const campaignId = Number(new URL(req.url).searchParams.get('campaignId'));
  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    return fail('A valid campaignId is required');
  }

  // RBAC: the agent must be assigned to this campaign or be in its group.
  if (!(await agentCanAccessCampaign(user.id, campaignId))) {
    return fail('You are not assigned to this campaign', 403);
  }

  // Campaign rules + active lists, read fresh so a list toggled OFF stops
  // handing out its leads immediately.
  const camp = await query<{ dial_statuses: unknown; recycle_rules: unknown }>(
    'SELECT dial_statuses, recycle_rules FROM campaigns WHERE id = ?',
    [campaignId],
  );
  if (!camp[0]) return fail('Campaign not found', 404);
  const lists = await query<{ id: number }>(
    "SELECT id FROM lists WHERE campaign_id = ? AND active = 'Y'",
    [campaignId],
  );
  if (lists.length === 0) return ok({ contact: null });

  const claim = buildClaimSelect({
    campaignId,
    listIds: lists.map((l) => l.id),
    dialStatuses: parseDialStatuses(camp[0].dial_statuses),
    recycleRules: parseRecycleRules(camp[0].recycle_rules),
    claimTimeoutSec: CLAIM_TIMEOUT_SEC,
  });
  if (!claim) return ok({ contact: null });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows]: any = await conn.execute(claim.sql, claim.params);
    const contact = rows[0];
    if (!contact) {
      await conn.commit();
      return ok({ contact: null });
    }

    // This route hands the lead straight to the agent to dial, so the claim
    // IS the dial: stamp it exactly like the engine's markDialed (called=1,
    // call_count+1, last_call_at) and consume a recycle attempt on
    // recycle-branch claims. The disposition route then only writes the
    // status — its counters no-op on called=1, so nothing double-counts and
    // recycle delay_min is measured from this dial.
    await conn.execute(
      `UPDATE csv_data
          SET claimed_at = NOW(), assigned_to = ?,
              called = 1, call_count = call_count + 1, last_call_at = NOW(),
              recycle_attempts = recycle_attempts + ?
        WHERE id = ?`,
      [user.id, Number(contact.via_recycle) === 1 ? 1 : 0, contact.id],
    );
    await conn.commit();
    return ok({ contact });
  } catch (e) {
    await conn.rollback();
    console.error('[dialer/next] claim failed:', e);
    return fail('Failed to fetch next contact', 500);
  } finally {
    conn.release();
  }
}

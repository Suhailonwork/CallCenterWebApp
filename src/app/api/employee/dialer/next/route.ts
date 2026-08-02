import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool, query, queryOne } from '@/lib/db';
import { agentCanAccessCampaign } from '@/lib/groups';
import { parseDialStatuses, parseRecycleRules, buildClaimSelect } from '@/lib/dialEligibility';
import { reserveLead } from '@/lib/leadWriter';
import { createDialerLog, EVENT } from '@/lib/dialerLog';

export const runtime = 'nodejs';

// A claimed-but-never-dialed contact is re-offered after this many seconds
// (covers an agent who closed the tab before placing the call). Kept in sync
// with the engine's dialer_claim_timeout_sec setting.
const CLAIM_TIMEOUT_SEC = 120;

interface CampaignRules {
  dial_statuses: unknown;
  recycle_rules: unknown;
  retry_count: number;
  retry_delay_minutes: number;
  lead_order: string;
}

/**
 * GET /api/employee/dialer/next?campaignId=N
 *
 * Hands the agent the next dialable lead and atomically RESERVES it
 * (SELECT ... FOR UPDATE SKIP LOCKED inside a transaction), so two agents can
 * never be given the same contact.
 *
 * The lead moves NEW -> QUEUED here. It is NOT counted as dialed yet: the
 * dial stamp (called=1, call_count+1, DIALING) is written by the ARI app the
 * moment the call actually goes out. An agent who never presses Call costs the
 * lead nothing — the engine's sweeper rolls the reservation back to the exact
 * status it held before.
 *
 * Eligibility is identical to the predictive engine's (shared builder in
 * src/lib/dialEligibility.js).
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
  const campaign = await queryOne<CampaignRules>(
    `SELECT dial_statuses, recycle_rules, retry_count, retry_delay_minutes, lead_order
       FROM campaigns WHERE id = ?`,
    [campaignId],
  );
  if (!campaign) return fail('Campaign not found', 404);

  const lists = await query<{ id: number }>(
    "SELECT id FROM lists WHERE campaign_id = ? AND active = 'Y'",
    [campaignId],
  );
  if (lists.length === 0) return ok({ contact: null, reason: 'no-active-lists' });

  const claim = buildClaimSelect({
    campaignId,
    listIds: lists.map((l) => l.id),
    dialStatuses: parseDialStatuses(campaign.dial_statuses),
    recycleRules: parseRecycleRules(campaign.recycle_rules, campaign.retry_delay_minutes),
    claimTimeoutSec: CLAIM_TIMEOUT_SEC,
    maxAttempts: Number(campaign.retry_count) || 0,
    leadOrder: campaign.lead_order,
    limit: 1,
  });
  if (!claim) return ok({ contact: null, reason: 'no-dialable-statuses' });

  const log = createDialerLog(pool, { tag: 'MANUAL' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows]: any = await conn.query(claim.sql, claim.params);
    const contact = rows[0];
    if (!contact) {
      await conn.commit();
      return ok({ contact: null, reason: 'no-contacts' });
    }

    const previous = await reserveLead(conn, {
      leadId: contact.id,
      agentId: user.id,
      currentStatus: contact.call_status,
    });
    await conn.commit();

    log.log(EVENT.RESERVED, {
      leadId: contact.id,
      campaignId,
      listId: contact.list_id,
      agentId: user.id,
      from: previous,
      to: 'QUEUED',
      detail: {
        phone: contact.phone_number,
        attempt: (Number(contact.call_count) || 0) + 1,
        recycle: Number(contact.via_recycle) === 1 ? 1 : 0,
        source: 'manual',
      },
    });

    return ok({ contact });
  } catch (e) {
    await conn.rollback();
    console.error('[dialer/next] claim failed:', e);
    return fail('Failed to fetch next contact', 500);
  } finally {
    conn.release();
  }
}

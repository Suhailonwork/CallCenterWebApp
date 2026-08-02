import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool } from '@/lib/db';
import { cancelReservation } from '@/lib/leadWriter';
import { createDialerLog, EVENT } from '@/lib/dialerLog';
import { broadcastChange } from '@/lib/realtime';

export const runtime = 'nodejs';

const schema = z.object({
  leadId: z.number().int().positive(),
  reason: z.enum(['skip', 'campaign-switch', 'closed']).optional(),
});

/**
 * POST /api/employee/dialer/release
 *
 * Hands a reserved-but-never-dialed lead back to the pool. Used by Skip /
 * Next Lead, by a campaign switch, and when the agent leaves the screen.
 *
 * This is NOT a call outcome. cancelReservation rolls the lead from QUEUED back
 * to exactly the status it held before it was offered, so `called`, `call_count`,
 * `recycle_attempts` and the call history are all untouched — skipping a lead
 * costs it nothing. It only applies to a lead still sitting on QUEUED; once a
 * call has gone out the status has moved on and the UPDATE matches nothing,
 * which is what we want (a real attempt is finalised by the wrap-up instead).
 */
export async function POST(req: Request) {
  const user = await authenticate(['employee']);
  if (isError(user)) return user;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid data');
  const { leadId, reason } = parsed.data;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Only the agent holding the claim may release it — otherwise a stale tab
    // could yank a lead another agent has since been given.
    const [rows]: any = await conn.query(
      'SELECT id, campaign_id, list_id, call_status, assigned_to FROM csv_data WHERE id = ? FOR UPDATE',
      [leadId],
    );
    const lead = rows[0];
    if (!lead) {
      await conn.rollback();
      return fail('Lead not found', 404);
    }
    if (lead.assigned_to !== null && Number(lead.assigned_to) !== user.id) {
      await conn.rollback();
      return ok({ released: false, reason: 'claimed-by-another-agent' });
    }

    await cancelReservation(conn, leadId);
    await conn.commit();

    createDialerLog(pool, { tag: 'MANUAL' }).log(EVENT.RELEASED, {
      leadId,
      campaignId: lead.campaign_id,
      listId: lead.list_id,
      agentId: user.id,
      detail: { reason: reason ?? 'skip', source: 'manual' },
    });

    // Other agents' availability changes the moment this lead frees up.
    broadcastChange('dialer');
    return ok({ released: true });
  } catch (e) {
    await conn.rollback();
    console.error('[dialer/release] failed:', e);
    return fail('Failed to release contact', 500);
  } finally {
    conn.release();
  }
}

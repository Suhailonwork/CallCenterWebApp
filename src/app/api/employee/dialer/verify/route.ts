import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool } from '@/lib/db';
import { agentCanAccessCampaign } from '@/lib/groups';
import { phoneIsBusy } from '@/lib/manualClaim';
import { LEAD_STATUS } from '@/lib/leadStatus';

export const runtime = 'nodejs';

const schema = z.object({ leadId: z.number().int().positive() });

/**
 * POST /api/employee/dialer/verify
 *
 * Last gate before a manual call leaves the browser. The lead was reserved when
 * it was handed over, but that may have been minutes ago — the agent could have
 * been reassigned, the claim could have expired and been re-offered, or another
 * row carrying the same customer number could have gone on a call meanwhile.
 *
 * Purely a check: nothing here writes `called`, `call_count` or a history row.
 * The dial stamp stays where it belongs, in the ARI app, once the call really
 * reaches Asterisk. A failed verification simply stops the dial.
 */
export async function POST(req: Request) {
  const user = await authenticate(['employee']);
  if (isError(user)) return user;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid data');
  const { leadId } = parsed.data;

  const conn = await pool.getConnection();
  try {
    // A short transaction with FOR UPDATE: the row cannot be re-claimed between
    // the check and the answer we hand back.
    await conn.beginTransaction();

    const [rows]: any = await conn.query(
      `SELECT id, campaign_id, phone_number, call_status, assigned_to
         FROM csv_data WHERE id = ? FOR UPDATE`,
      [leadId],
    );
    const lead = rows[0];
    if (!lead) {
      await conn.commit();
      return ok({ allowed: false, reason: 'lead-not-found' });
    }

    if (Number(lead.assigned_to) !== user.id) {
      await conn.commit();
      return ok({ allowed: false, reason: 'claimed-by-another-agent' });
    }

    // Still reserved and not already dialing — anything else means the lead has
    // moved on since it was handed over.
    if (String(lead.call_status).toUpperCase() !== LEAD_STATUS.QUEUED) {
      await conn.commit();
      return ok({ allowed: false, reason: 'lead-no-longer-queued' });
    }

    if (!(await agentCanAccessCampaign(user.id, lead.campaign_id))) {
      await conn.commit();
      return ok({ allowed: false, reason: 'campaign-not-assigned' });
    }

    const busyOn = await phoneIsBusy(conn, lead.phone_number, leadId);
    if (busyOn !== null) {
      await conn.commit();
      return ok({ allowed: false, reason: 'phone-already-on-a-call' });
    }

    await conn.commit();
    return ok({ allowed: true, phoneNumber: lead.phone_number });
  } catch (e) {
    await conn.rollback();
    console.error('[dialer/verify] failed:', e);
    return fail('Could not verify the contact', 500);
  } finally {
    conn.release();
  }
}

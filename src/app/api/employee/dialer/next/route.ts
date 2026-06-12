import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool } from '@/lib/db';
import { agentCanAccessCampaign } from '@/lib/groups';

export const runtime = 'nodejs';

// A claimed-but-never-dialed contact is re-offered after this many minutes
// (covers an agent who closed the tab before placing the call).
const CLAIM_TIMEOUT_MIN = 2;

/**
 * GET /api/employee/dialer/next?campaignId=N
 * Returns the next un-called contact (FIFO) and atomically *claims* it inside a
 * transaction (SELECT ... FOR UPDATE), so two agents on the same campaign can
 * never be handed the same contact.
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

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows]: any = await conn.execute(
      `SELECT id, phone_number, name, email, company
         FROM csv_data
        WHERE campaign_id = ?
          AND called = 0
          AND (claimed_at IS NULL OR claimed_at < DATE_SUB(NOW(), INTERVAL ? MINUTE))
        ORDER BY id ASC
        LIMIT 1
        FOR UPDATE`,
      [campaignId, CLAIM_TIMEOUT_MIN],
    );

    const contact = rows[0];
    if (!contact) {
      await conn.commit();
      return ok({ contact: null });
    }

    await conn.execute(
      'UPDATE csv_data SET claimed_at = NOW(), assigned_to = ? WHERE id = ?',
      [user.id, contact.id],
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

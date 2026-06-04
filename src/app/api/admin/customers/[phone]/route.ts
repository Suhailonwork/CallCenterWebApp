import { authenticate, isError, ok, fail } from '@/lib/api';
import { query, queryOne } from '@/lib/db';

export const runtime = 'nodejs';

/** GET /api/admin/customers/[phone] — all calls for one phone number, across campaigns. */
export async function GET(
  _req: Request,
  { params }: { params: { phone: string } },
) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const phone = decodeURIComponent(params.phone).trim();
  if (!phone) return fail('Invalid phone number');

  // Most recent known name for this number
  const info = await queryOne<any>(
    `SELECT phone_number,
            MAX(contact_name) AS contact_name,
            COUNT(*) AS total_calls,
            SUM(status IN ('connected','completed')) AS connected,
            SUM(status = 'completed') AS success,
            COALESCE(SUM(duration_seconds), 0) AS talk_seconds,
            MIN(started_at) AS first_call,
            MAX(started_at) AS last_call
       FROM calls
      WHERE phone_number = ?`,
    [phone],
  );

  if (!info || Number(info.total_calls) === 0) {
    return fail('No calls found for this number', 404);
  }

  // Per-agent breakdown: which agent called how many times
  const byAgent = await query<any>(
    `SELECT u.id AS agent_id, u.name AS agent_name,
            COUNT(c.id) AS calls,
            SUM(c.status = 'completed') AS success,
            COALESCE(SUM(c.duration_seconds), 0) AS talk_seconds
       FROM calls c
       LEFT JOIN users u ON u.id = c.employee_id
      WHERE c.phone_number = ?
      GROUP BY u.id, u.name
      ORDER BY calls DESC`,
    [phone],
  );

  // Every call (all campaigns)
  const calls = await query<any>(
    `SELECT c.id, c.campaign_id, c.direction, c.status,
            c.duration_seconds, c.recording_url,
            DATE_FORMAT(c.started_at, '%Y-%m-%d %H:%i:%s') AS started_at,
            u.name AS agent_name,
            cmp.name AS campaign_name
       FROM calls c
       LEFT JOIN users u     ON u.id = c.employee_id
       LEFT JOIN campaigns cmp ON cmp.id = c.campaign_id
      WHERE c.phone_number = ?
      ORDER BY c.id DESC
      LIMIT 500`,
    [phone],
  );

  return ok({ info, byAgent, calls });
}
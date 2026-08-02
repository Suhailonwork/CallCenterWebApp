import { authenticate, isError, ok, fail } from '@/lib/api';
import { query, queryOne } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/leads/:id — one contact's complete story: its current
 * lifecycle state, every call attempt made against it, and the full dialer
 * event trail (selected → reserved → dial started → gateway → answered →
 * failed → retry scheduled → disposition → completed).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin', 'manager', 'tl']);
  if (isError(u)) return u;

  const leadId = Number(params.id);
  if (!Number.isInteger(leadId) || leadId <= 0) return fail('Invalid lead id');

  const lead = await queryOne<any>(
    `SELECT d.id, d.phone_number, d.name, d.email, d.company, d.custom_fields,
            d.campaign_id, ca.name AS campaign_name,
            d.list_id, l.name AS list_name, l.active AS list_active,
            d.call_status, d.called, d.call_count, d.recycle_attempts,
            d.priority, d.last_disposition, d.pre_dial_status,
            d.assigned_to, ag.name AS assigned_name,
            d.last_gateway_id, g.name AS last_gateway_name,
            DATE_FORMAT(d.last_call_at,      '%Y-%m-%dT%H:%i:%s') AS last_call_at,
            DATE_FORMAT(d.next_retry_at,     '%Y-%m-%dT%H:%i:%s') AS next_retry_at,
            DATE_FORMAT(d.claimed_at,        '%Y-%m-%dT%H:%i:%s') AS claimed_at,
            DATE_FORMAT(d.status_changed_at, '%Y-%m-%dT%H:%i:%s') AS status_changed_at,
            DATE_FORMAT(d.completed_at,      '%Y-%m-%dT%H:%i:%s') AS completed_at,
            DATE_FORMAT(d.created_at,        '%Y-%m-%dT%H:%i:%s') AS created_at
       FROM csv_data d
       JOIN campaigns ca ON ca.id = d.campaign_id
       LEFT JOIN lists l        ON l.id = d.list_id
       LEFT JOIN users ag       ON ag.id = d.assigned_to
       LEFT JOIN gsm_gateways g ON g.id = d.last_gateway_id
      WHERE d.id = ?`,
    [leadId],
  );
  if (!lead) return fail('Contact not found', 404);

  const [calls, events] = await Promise.all([
    query<any>(
      `SELECT c.id, c.status, c.lead_status, c.disposition, c.dial_source,
              c.attempt_no, c.duration_seconds, c.ring_seconds, c.hangup_cause,
              c.recording_url,
              c.employee_id, u.name AS agent_name,
              c.gateway_id, g.name AS gateway_name,
              DATE_FORMAT(c.started_at,  '%Y-%m-%dT%H:%i:%s') AS started_at,
              DATE_FORMAT(c.answered_at, '%Y-%m-%dT%H:%i:%s') AS answered_at,
              DATE_FORMAT(c.ended_at,    '%Y-%m-%dT%H:%i:%s') AS ended_at,
              n.note, n.tags
         FROM calls c
         LEFT JOIN users u        ON u.id = c.employee_id
         LEFT JOIN gsm_gateways g ON g.id = c.gateway_id
         LEFT JOIN call_notes n   ON n.call_id = c.id
        WHERE c.csv_data_id = ?
        ORDER BY c.id DESC
        LIMIT 200`,
      [leadId],
    ),
    query<any>(
      `SELECT id, event, status_from, status_to, agent_id, gateway_id, call_id, detail,
              DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.%f') AS created_at
         FROM dialer_log
        WHERE csv_data_id = ?
        ORDER BY id DESC
        LIMIT 500`,
      [leadId],
    ).catch(() => []),
  ]);

  return ok({ lead, calls, events });
}

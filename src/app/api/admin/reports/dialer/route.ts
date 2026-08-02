import { authenticate, isError, ok, fail } from '@/lib/api';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/reports/dialer?type=…&from=…&to=…[&campaignId=…][&format=csv]
 *
 * The dialer reporting surface, one endpoint per requirement 14:
 *
 *   type=campaign — attempts, connect rate, abandon rate, talk time per campaign
 *   type=agent    — calls handled, connect rate, talk/wrap time per agent
 *   type=gateway  — attempts, answer rate, failures per gateway
 *   type=contact  — per-lead attempt history with the current status
 *   type=hourly   — attempts / connects / abandons per hour
 *   type=status   — lead-status distribution across lists
 *
 * `from`/`to` are inclusive dates (YYYY-MM-DD); they default to today.
 */
const TYPES = ['campaign', 'agent', 'gateway', 'contact', 'hourly', 'status'] as const;
type ReportType = (typeof TYPES)[number];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map((c) => csvCell(r[c])).join(','));
  return lines.join('\n');
}

export async function GET(req: Request) {
  const u = await authenticate(['admin', 'manager', 'tl']);
  if (isError(u)) return u;

  const sp = new URL(req.url).searchParams;
  const type = (sp.get('type') ?? 'campaign') as ReportType;
  if (!TYPES.includes(type)) return fail(`type must be one of: ${TYPES.join(', ')}`);

  const from = sp.get('from') ?? '';
  const to = sp.get('to') ?? '';
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    return fail('from/to must be YYYY-MM-DD');
  }
  // Half-open range so the query stays sargable on created_at.
  const start = from || new Date().toISOString().slice(0, 10);
  const endExclusive = to || start;

  const campaignIdRaw = sp.get('campaignId');
  const campaignId = campaignIdRaw ? Number(campaignIdRaw) : null;
  if (campaignIdRaw && (!Number.isInteger(campaignId) || campaignId! <= 0)) {
    return fail('Invalid campaignId');
  }

  const range = [start, endExclusive];
  const campFilter = campaignId ? ' AND c.campaign_id = ?' : '';
  const campParam = campaignId ? [campaignId] : [];

  let rows: Record<string, unknown>[] = [];

  if (type === 'campaign') {
    rows = await query(
      `SELECT ca.id                                          AS campaign_id,
              ca.name                                        AS campaign,
              ca.dialer_type,
              COUNT(c.id)                                    AS attempts,
              COALESCE(SUM(c.answered_at IS NOT NULL), 0)    AS answered,
              COALESCE(SUM(c.status = 'connected'), 0)       AS connected,
              COALESCE(SUM(c.status = 'abandoned'), 0)       AS abandoned,
              COALESCE(SUM(c.status = 'no_answer'), 0)       AS no_answer,
              COALESCE(SUM(c.status = 'busy'), 0)            AS busy,
              COALESCE(SUM(c.status = 'failed'), 0)          AS failed,
              COALESCE(SUM(c.status = 'voicemail'), 0)       AS voicemail,
              COALESCE(SUM(c.duration_seconds), 0)           AS talk_seconds,
              ROUND(100 * COALESCE(SUM(c.status = 'connected'), 0)
                        / GREATEST(COUNT(c.id), 1), 2)       AS connect_pct,
              ROUND(100 * COALESCE(SUM(c.status = 'abandoned'), 0)
                        / GREATEST(COALESCE(SUM(c.answered_at IS NOT NULL), 0), 1), 2)
                                                             AS abandon_pct,
              ROUND(AVG(NULLIF(c.ring_seconds, 0)), 1)       AS avg_ring_seconds
         FROM campaigns ca
         LEFT JOIN calls c
           ON c.campaign_id = ca.id
          AND c.created_at >= ? AND c.created_at < DATE_ADD(?, INTERVAL 1 DAY)
        ${campaignId ? 'WHERE ca.id = ?' : ''}
        GROUP BY ca.id
        ORDER BY attempts DESC, ca.name`,
      [...range, ...campParam],
    );
  } else if (type === 'agent') {
    rows = await query(
      `SELECT u.id                                        AS agent_id,
              u.name                                      AS agent,
              COUNT(c.id)                                 AS calls,
              COALESCE(SUM(c.status = 'connected'), 0)    AS connected,
              COALESCE(SUM(c.duration_seconds), 0)        AS talk_seconds,
              ROUND(AVG(NULLIF(c.duration_seconds, 0)), 1) AS avg_talk_seconds,
              ROUND(100 * COALESCE(SUM(c.status = 'connected'), 0)
                        / GREATEST(COUNT(c.id), 1), 2)    AS connect_pct,
              COUNT(DISTINCT c.csv_data_id)               AS contacts,
              COUNT(DISTINCT c.disposition)               AS dispositions_used
         FROM users u
         JOIN calls c
           ON c.employee_id = u.id
          AND c.created_at >= ? AND c.created_at < DATE_ADD(?, INTERVAL 1 DAY)
        WHERE u.role = 'employee'${campFilter}
        GROUP BY u.id
        ORDER BY calls DESC, u.name`,
      [...range, ...campParam],
    );
  } else if (type === 'gateway') {
    rows = await query(
      `SELECT g.id                                        AS gateway_id,
              g.name                                      AS gateway,
              g.ip, g.channels, g.status, g.reachable, g.fail_count,
              COUNT(c.id)                                 AS attempts,
              COALESCE(SUM(c.answered_at IS NOT NULL), 0) AS answered,
              COALESCE(SUM(c.status = 'connected'), 0)    AS connected,
              COALESCE(SUM(c.status = 'failed'), 0)       AS failed,
              COALESCE(SUM(c.duration_seconds), 0)        AS talk_seconds,
              ROUND(100 * COALESCE(SUM(c.answered_at IS NOT NULL), 0)
                        / GREATEST(COUNT(c.id), 1), 2)    AS answer_pct,
              ROUND(AVG(NULLIF(c.ring_seconds, 0)), 1)    AS avg_ring_seconds
         FROM gsm_gateways g
         LEFT JOIN calls c
           ON c.gateway_id = g.id
          AND c.created_at >= ? AND c.created_at < DATE_ADD(?, INTERVAL 1 DAY)
          ${campaignId ? 'AND c.campaign_id = ?' : ''}
        GROUP BY g.id
        ORDER BY attempts DESC, g.name`,
      [...range, ...campParam],
    );
  } else if (type === 'contact') {
    rows = await query(
      `SELECT d.id                                     AS lead_id,
              d.phone_number, d.name                   AS contact,
              ca.name                                  AS campaign,
              l.name                                   AS list,
              d.call_status                            AS status,
              d.called, d.call_count                   AS attempts,
              d.recycle_attempts, d.last_disposition,
              DATE_FORMAT(d.last_call_at,  '%Y-%m-%dT%H:%i:%s') AS last_call_at,
              DATE_FORMAT(d.next_retry_at, '%Y-%m-%dT%H:%i:%s') AS next_retry_at,
              DATE_FORMAT(d.completed_at,  '%Y-%m-%dT%H:%i:%s') AS completed_at,
              COALESCE(SUM(c.status = 'connected'), 0) AS connects,
              COALESCE(SUM(c.duration_seconds), 0)     AS talk_seconds
         FROM csv_data d
         JOIN campaigns ca ON ca.id = d.campaign_id
         LEFT JOIN lists l ON l.id = d.list_id
         LEFT JOIN calls c ON c.csv_data_id = d.id
        WHERE d.last_call_at >= ? AND d.last_call_at < DATE_ADD(?, INTERVAL 1 DAY)
          ${campaignId ? 'AND d.campaign_id = ?' : ''}
        GROUP BY d.id
        ORDER BY d.last_call_at DESC
        LIMIT 5000`,
      [...range, ...campParam],
    );
  } else if (type === 'hourly') {
    rows = await query(
      `SELECT DATE(c.created_at)                        AS day,
              HOUR(c.created_at)                        AS hour,
              COUNT(*)                                  AS attempts,
              COALESCE(SUM(c.answered_at IS NOT NULL), 0) AS answered,
              COALESCE(SUM(c.status = 'connected'), 0)  AS connected,
              COALESCE(SUM(c.status = 'abandoned'), 0)  AS abandoned,
              COALESCE(SUM(c.duration_seconds), 0)      AS talk_seconds,
              ROUND(100 * COALESCE(SUM(c.status = 'connected'), 0)
                        / GREATEST(COUNT(*), 1), 2)     AS connect_pct
         FROM calls c
        WHERE c.created_at >= ? AND c.created_at < DATE_ADD(?, INTERVAL 1 DAY)
          ${campaignId ? 'AND c.campaign_id = ?' : ''}
        GROUP BY day, hour
        ORDER BY day, hour`,
      [...range, ...campParam],
    );
  } else {
    // status — a point-in-time picture, not a date range.
    rows = await query(
      `SELECT ca.name                AS campaign,
              l.name                 AS list,
              l.active               AS list_active,
              d.call_status          AS status,
              COUNT(*)               AS leads,
              COALESCE(SUM(d.called = 0), 0)                       AS fresh,
              COALESCE(SUM(d.next_retry_at > NOW()), 0)            AS waiting_retry
         FROM csv_data d
         JOIN campaigns ca ON ca.id = d.campaign_id
         LEFT JOIN lists l ON l.id = d.list_id
        ${campaignId ? 'WHERE d.campaign_id = ?' : ''}
        GROUP BY ca.id, l.id, d.call_status
        ORDER BY ca.name, l.name, leads DESC`,
      campParam,
    );
  }

  const normalised = rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) out[k] = typeof v === 'bigint' ? Number(v) : v;
    return out;
  });

  if (sp.get('format') === 'csv') {
    return new Response(toCsv(normalised), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="dialer-${type}-${start}.csv"`,
      },
    });
  }

  return ok({ type, from: start, to: endExclusive, campaignId, rows: normalised });
}

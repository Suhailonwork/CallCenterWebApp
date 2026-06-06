import { authenticate, isError, ok } from '@/lib/api';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/admin/reports
 *   ?from=YYYY-MM-DD &to=YYYY-MM-DD &status=... &employeeId=N &format=csv
 * Filtered call report. format=csv streams a CSV download.
 */
export async function GET(req: Request) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const status = url.searchParams.get('status');
  const employeeId = Number(url.searchParams.get('employeeId') || 0);
  const format = url.searchParams.get('format');

  const where: string[] = [];
  const params: any[] = [];
  if (from) {
    where.push('c.created_at >= ?');
    params.push(`${from} 00:00:00`);
  }
  if (to) {
    where.push('c.created_at <= ?');
    params.push(`${to} 23:59:59`);
  }
  if (status) {
    where.push('c.status = ?');
    params.push(status);
  }
  if (employeeId > 0) {
    where.push('c.employee_id = ?');
    params.push(employeeId);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query<any>(
    `SELECT c.id, u.name AS employee_name, c.phone_number, c.contact_name,
            c.status, c.duration_seconds, cm.name AS campaign_name,
            DATE_FORMAT(c.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
       FROM calls c
       JOIN users u ON u.id = c.employee_id
       LEFT JOIN campaigns cm ON cm.id = c.campaign_id
       ${whereSql}
      ORDER BY c.created_at DESC
      LIMIT 2000`,
    params,
  );

  if (format === 'csv') {
    const header = [
      'Date', 'Employee', 'Phone', 'Contact', 'Status', 'Duration (s)', 'Campaign',
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.created_at, r.employee_name, r.phone_number, r.contact_name,
          r.status, r.duration_seconds, r.campaign_name,
        ]
          .map(csvCell)
          .join(','),
      );
    }
    return new Response(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="call-report.csv"',
      },
    });
  }

  const total = rows.length;
  const connected = rows.filter((r) => r.status === 'connected').length;
  const talkSeconds = rows.reduce((a, r) => a + Number(r.duration_seconds), 0);
  return ok({
    rows,
    summary: {
      total,
      connected,
      successRate: total > 0 ? Math.round((connected / total) * 100) : 0,
      talkSeconds,
    },
  });
}

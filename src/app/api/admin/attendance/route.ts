import { authenticate, isError, ok } from '@/lib/api';
import { query } from '@/lib/db';
import { tlTeam } from '@/lib/groups';
import {
  buildAttendance,
  resolveRange,
  getScopeUsers,
  agentIdsForCampaign,
  sweepStaleSessions,
  attendanceRowsForExport,
  attendanceCsv,
} from '@/lib/attendance';

export const runtime = 'nodejs';

/**
 * GET /api/admin/attendance — attendance for every user (admin scope).
 *
 * Query params:
 *   preset      today | yesterday | week | month | custom (default today)
 *   from, to    YYYY-MM-DD (used when preset=custom)
 *   tlId        narrow to one TL's team
 *   employeeId  narrow to one user
 *   campaignId  narrow to agents of a campaign's group
 *   status      on_time | grace | late | logged_in | logged_out | absent
 *   q           search by name / email
 *   page, pageSize   session-log pagination
 *   format=csv  stream the filtered session log as CSV
 */
export async function GET(req: Request) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  // Eventually-consistent: close any sessions whose heartbeat went stale.
  await sweepStaleSessions();

  const sp = new URL(req.url).searchParams;
  const { from, to, preset } = resolveRange(sp.get('preset'), sp.get('from'), sp.get('to'));

  const employeeId = Number(sp.get('employeeId')) || 0;
  const tlId = Number(sp.get('tlId')) || 0;
  const campaignId = Number(sp.get('campaignId')) || 0;

  // Resolve the scope user-id set (null = all active users).
  let scopeIds: number[] | null = null;
  if (employeeId > 0) scopeIds = [employeeId];
  else if (tlId > 0) scopeIds = (await tlTeam(tlId)).map((e) => e.id);
  else if (campaignId > 0) scopeIds = await agentIdsForCampaign(campaignId);

  const scopeUsers = await getScopeUsers(scopeIds);
  const ids = scopeUsers.map((s) => s.id);

  const status = sp.get('status');
  const q = sp.get('q');

  if (sp.get('format') === 'csv') {
    const rows = await attendanceRowsForExport(ids, from, to, status, q);
    return new Response(attendanceCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="attendance-${from}_to_${to}.csv"`,
      },
    });
  }

  const data = await buildAttendance(scopeUsers, {
    from,
    to,
    status,
    q,
    page: Number(sp.get('page')) || 1,
    pageSize: Number(sp.get('pageSize')) || 50,
  });

  // Filter options for the UI.
  const tls = await query<{ id: number; name: string }>(
    `SELECT id, name FROM users WHERE role = 'tl' AND is_active = 1 ORDER BY name`,
  );

  return ok({ ...data, from, to, preset, tls });
}

import { authenticate, isError, ok } from '@/lib/api';
import { tlTeam } from '@/lib/groups';
import {
  buildAttendance,
  resolveRange,
  getScopeUsers,
  sweepStaleSessions,
  attendanceRowsForExport,
  attendanceCsv,
} from '@/lib/attendance';

export const runtime = 'nodejs';

/**
 * GET /api/tl/attendance — attendance for the TL's own agents only.
 *
 * The scope is always `tlTeam(tl.id)` (legacy reporting line + the agents of
 * the TL's groups, deduped). An `employeeId` filter is intersected with that
 * set, so a TL can never read another TL's agents.
 */
export async function GET(req: Request) {
  const u = await authenticate(['tl']);
  if (isError(u)) return u;

  await sweepStaleSessions();

  const sp = new URL(req.url).searchParams;
  const { from, to, preset } = resolveRange(sp.get('preset'), sp.get('from'), sp.get('to'));

  const team = await tlTeam(u.id);
  let ids = team.map((e) => e.id);

  const employeeId = Number(sp.get('employeeId')) || 0;
  if (employeeId > 0) ids = ids.includes(employeeId) ? [employeeId] : [];

  const scopeUsers = await getScopeUsers(ids);
  const status = sp.get('status');
  const q = sp.get('q');

  if (sp.get('format') === 'csv') {
    const rows = await attendanceRowsForExport(
      scopeUsers.map((s) => s.id),
      from,
      to,
      status,
      q,
    );
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

  // TLs do not get a TL filter dropdown (they only see their own team).
  return ok({ ...data, from, to, preset, tls: [] });
}

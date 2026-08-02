import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { tlTeam, groupIdsForTL } from '@/lib/groups';
import { statsForEmployees } from '@/lib/orgMetrics';
import { query, queryOne } from '@/lib/db';
import { TLDashboard } from '@/components/TLDashboard';

export const dynamic = 'force-dynamic';

export default async function TeamLeadDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Legacy reporting line + agents of the TL's groups, deduped.
  const employees = await tlTeam(user.id);
  const groupIds = await groupIdsForTL(user.id);
  const stats = await statsForEmployees(employees.map((e) => e.id));

  let pendingBreaks = 0;
  if (employees.length > 0) {
    const ph = employees.map(() => '?').join(',');
    const row = await queryOne<{ c: number }>(
      `SELECT COUNT(*) AS c FROM breaks
        WHERE employee_id IN (${ph}) AND status = 'requested'`,
      employees.map((e) => e.id),
    );
    pendingBreaks = Number(row?.c ?? 0);
  }

  // Today's call log for the TL's people / group campaigns. The page is
  // force-dynamic and ConsoleShell mounts <LiveRefresh scopes=['calls']>,
  // so this list re-renders live whenever an agent logs a call.
  let recentCalls: any[] = [];
  const empIds = employees.map((e) => e.id);
  if (empIds.length > 0 || groupIds.length > 0) {
    const conds: string[] = [];
    const params: any[] = [];
    if (empIds.length > 0) {
      conds.push(`c.employee_id IN (${empIds.map(() => '?').join(',')})`);
      params.push(...empIds);
    }
    if (groupIds.length > 0) {
      conds.push(
        `c.campaign_id IN (SELECT id FROM campaigns WHERE group_id IN (${groupIds.map(() => '?').join(',')}))`,
      );
      params.push(...groupIds);
    }
    recentCalls = await query<any>(
      `SELECT c.id, c.phone_number, c.contact_name, c.status, c.duration_seconds,
              DATE_FORMAT(c.created_at, '%H:%i') AS at_time,
              u.name AS agent_name,
              cmp.name AS campaign_name,
              n.tags AS dispo
         FROM calls c
         JOIN users u ON u.id = c.employee_id
         LEFT JOIN campaigns cmp ON cmp.id = c.campaign_id
         LEFT JOIN call_notes n ON n.call_id = c.id
        WHERE (${conds.join(' OR ')})
          AND c.created_at >= CURDATE()
        ORDER BY c.id DESC
        LIMIT 20`,
      params,
    );
  }

  return (
    <TLDashboard
      stats={stats}
      pendingBreaks={pendingBreaks}
      recentCalls={recentCalls}
    />
  );
}

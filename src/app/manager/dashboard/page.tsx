import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { tlsUnderManager, employeesUnderManager } from '@/lib/org';
import { statsForEmployees } from '@/lib/orgMetrics';
import { queryOne } from '@/lib/db';
import { ManagerDashboard } from '@/components/ManagerDashboard';

export const dynamic = 'force-dynamic';

export default async function ManagerDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const tls = await tlsUnderManager(user.id);
  const employees = await employeesUnderManager(user.id);
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

  return (
    <ManagerDashboard
      tls={tls.map((t) => ({ id: t.id, name: t.name }))}
      employees={employees.map((e) => ({
        id: e.id,
        name: e.name,
        reports_to: e.reports_to,
      }))}
      stats={stats}
      pendingBreaks={pendingBreaks}
    />
  );
}

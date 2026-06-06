import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { employeesUnderTL } from '@/lib/org';
import { statsForEmployees } from '@/lib/orgMetrics';
import { queryOne } from '@/lib/db';
import { TLDashboard } from '@/components/TLDashboard';

export const dynamic = 'force-dynamic';

export default async function TeamLeadDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const employees = await employeesUnderTL(user.id);
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

  return <TLDashboard stats={stats} pendingBreaks={pendingBreaks} />;
}

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getEmployeeDashboard } from '@/lib/metrics';
import { DashboardView } from '@/components/DashboardView';

export const dynamic = 'force-dynamic';

export default async function EmployeeDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const data = await getEmployeeDashboard(user.id);
  return <DashboardView userName={user.name} data={data} />;
}

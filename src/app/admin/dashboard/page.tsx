import { systemKpis, statsForEmployees } from '@/lib/orgMetrics';
import { listUsers } from '@/lib/org';
import { AdminDashboard } from '@/components/AdminDashboard';
import { LiveAgents } from '@/components/LiveAgents';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const kpis = await systemKpis();
  const users = await listUsers();
  const stats = await statsForEmployees(
    users.filter((u) => u.role === 'employee' && u.is_active).map((u) => u.id),
  );
  return (
    <div className="space-y-6">
      <LiveAgents />
      <AdminDashboard kpis={kpis} stats={stats} />
    </div>
  );
}

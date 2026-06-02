import { systemKpis, statsForEmployees } from '@/lib/orgMetrics';
import { listUsers } from '@/lib/org';
import { AdminDashboard } from '@/components/AdminDashboard';
import { LiveAgents } from '@/components/LiveAgents';
import AgentStatsTable from '@/components/AgentStatsTable';


export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  // KPIs and the user list don't depend on each other — fetch in parallel.
  const [kpis, users] = await Promise.all([systemKpis(), listUsers()]);
  const stats = await statsForEmployees(
    users.filter((u) => u.role === 'employee' && u.is_active).map((u) => u.id),
  );
  return (
    <div className="space-y-6">
      <LiveAgents />
      {/* <AdminDashboard kpis={kpis} stats={stats} /> */}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Agent Report (Today)</h2>
        <AgentStatsTable />
      </section>
    </div>
  );
}

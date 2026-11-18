import { RealtimeDashboard } from '@/components/RealtimeDashboard';
import AgentStatsTable from '@/components/AgentStatsTable';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <RealtimeDashboard />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Agent Report (Today)</h2>
        <AgentStatsTable />
      </section>
    </div>
  );
}

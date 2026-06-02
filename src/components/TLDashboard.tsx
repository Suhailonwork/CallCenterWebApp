import type { EmployeeStat } from '@/types';

function talk(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const STATUS_STYLE: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  on_call: 'bg-indigo-100 text-indigo-700',
  break: 'bg-amber-100 text-amber-700',
  offline: 'bg-slate-100 text-slate-500',
};

export function TLDashboard({
  stats,
  pendingBreaks,
}: {
  stats: EmployeeStat[];
  pendingBreaks: number;
}) {
  const totalCalls = stats.reduce((a, s) => a + s.calls, 0);
  const totalConnected = stats.reduce((a, s) => a + s.connected, 0);
  const successRate =
    totalCalls > 0 ? Math.round((totalConnected / totalCalls) * 100) : 0;

  const cards = [
    { label: 'Employees', value: stats.length },
    { label: 'Calls today', value: totalCalls },
    { label: 'Connected', value: totalConnected },
    { label: 'Success rate', value: `${successRate}%` },
    { label: 'Pending breaks', value: pendingBreaks },
  ];
  const sorted = [...stats].sort((a, b) => b.calls - a.calls);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">
          My team — today
        </h2>
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-400">No employees assigned to you.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-400">
                <th className="pb-2">Employee</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Calls</th>
                <th className="pb-2 text-right">Connected</th>
                <th className="pb-2 text-right">Success</th>
                <th className="pb-2 text-right">Talk time</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 font-medium">{s.name}</td>
                  <td className="py-2">
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-xs font-medium ' +
                        (STATUS_STYLE[s.status] ?? STATUS_STYLE.offline)
                      }
                    >
                      {s.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2 text-right">{s.calls}</td>
                  <td className="py-2 text-right">{s.connected}</td>
                  <td className="py-2 text-right">{s.successRate}%</td>
                  <td className="py-2 text-right">{talk(s.talkSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

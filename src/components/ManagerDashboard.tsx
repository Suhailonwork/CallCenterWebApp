import type { EmployeeStat } from '@/types';

function talk(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface Props {
  tls: { id: number; name: string }[];
  employees: { id: number; name: string; reports_to: number | null }[];
  stats: EmployeeStat[];
  pendingBreaks: number;
}

export function ManagerDashboard({ tls, employees, stats, pendingBreaks }: Props) {
  const byId = new Map(stats.map((s) => [s.id, s]));
  const totalCalls = stats.reduce((a, s) => a + s.calls, 0);
  const totalConnected = stats.reduce((a, s) => a + s.connected, 0);
  const successRate =
    totalCalls > 0 ? Math.round((totalConnected / totalCalls) * 100) : 0;

  const tlRows = tls.map((tl) => {
    const emps = employees.filter((e) => e.reports_to === tl.id);
    const s = emps
      .map((e) => byId.get(e.id))
      .filter((x): x is EmployeeStat => Boolean(x));
    const calls = s.reduce((a, x) => a + x.calls, 0);
    const conn = s.reduce((a, x) => a + x.connected, 0);
    return {
      id: tl.id,
      name: tl.name,
      employees: emps.length,
      calls,
      successRate: calls > 0 ? Math.round((conn / calls) * 100) : 0,
    };
  });

  const cards = [
    { label: 'Team Leads', value: tls.length },
    { label: 'Employees', value: employees.length },
    { label: 'Calls today', value: totalCalls },
    { label: 'Connected', value: totalConnected },
    { label: 'Success rate', value: `${successRate}%` },
    { label: 'Pending breaks', value: pendingBreaks },
  ];
  const sorted = [...stats].sort((a, b) => b.calls - a.calls);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">
          Team Leads — today
        </h2>
        {tlRows.length === 0 ? (
          <p className="text-sm text-slate-400">No team leads assigned.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-400">
                <th className="pb-2">Team Lead</th>
                <th className="pb-2 text-right">Employees</th>
                <th className="pb-2 text-right">Calls</th>
                <th className="pb-2 text-right">Success</th>
              </tr>
            </thead>
            <tbody>
              {tlRows.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 font-medium">{t.name}</td>
                  <td className="py-2 text-right">{t.employees}</td>
                  <td className="py-2 text-right">{t.calls}</td>
                  <td className="py-2 text-right">{t.successRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">
          Employees — today
        </h2>
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-400">No employees assigned.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-400">
                <th className="pb-2">Employee</th>
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

import type { EmployeeStat } from '@/types';

function talk(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function dur(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const STATUS_STYLE: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  on_call: 'bg-indigo-100 text-indigo-700',
  break: 'bg-amber-100 text-amber-700',
  offline: 'bg-slate-100 text-slate-500',
};

const CALL_BADGE: Record<string, string> = {
  connected: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  no_answer: 'bg-amber-100 text-amber-700',
  busy: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-600',
  voicemail: 'bg-slate-100 text-slate-600',
  wrong_number: 'bg-red-100 text-red-600',
};

export interface TLRecentCall {
  id: number;
  phone_number: string;
  contact_name: string | null;
  status: string;
  duration_seconds: number;
  at_time: string;
  agent_name: string | null;
  campaign_name: string | null;
  dispo: string | null;
}

export function TLDashboard({
  stats,
  pendingBreaks,
  recentCalls = [],
}: {
  stats: EmployeeStat[];
  pendingBreaks: number;
  recentCalls?: TLRecentCall[];
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

      {/* Live call log — re-renders automatically on every logged call
          (ConsoleShell mounts LiveRefresh on the 'calls' scope). */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">
          Recent calls — today
          <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            ● live
          </span>
        </h2>
        {recentCalls.length === 0 ? (
          <p className="text-sm text-slate-400">
            No calls yet today from your group&apos;s campaigns.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-400">
                  <th className="pb-2 pr-3">Time</th>
                  <th className="pb-2 pr-3">Agent</th>
                  <th className="pb-2 pr-3">Campaign</th>
                  <th className="pb-2 pr-3">Phone</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Dispo</th>
                  <th className="pb-2 text-right">Duration</th>
                </tr>
              </thead>
              <tbody>
                {recentCalls.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 text-xs text-slate-500">{c.at_time}</td>
                    <td className="py-2 pr-3 font-medium">{c.agent_name ?? '—'}</td>
                    <td className="py-2 pr-3 text-slate-600">{c.campaign_name ?? '—'}</td>
                    <td className="py-2 pr-3">{c.phone_number}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-xs font-medium ' +
                          (CALL_BADGE[c.status] ?? 'bg-slate-100 text-slate-600')
                        }
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {c.dispo ? (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                          {c.dispo}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right">{dur(Number(c.duration_seconds))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';

type Agent = {
  id: number;
  employee: string;
  role: string;
  status: string;
  calls: number;
  connected: number;
  success: number;
  talkSeconds: number;
  loginSeconds: number;
};

function fmtTalk(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function fmtHrs(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  tl: 'TL',
  employee: 'Employee',
  admin: 'Admin',
};

const STATUS_DOT: Record<string, string> = {
  available: 'bg-green-500',
  on_call: 'bg-blue-500',
  break: 'bg-amber-500',
  offline: 'bg-gray-400',
};

const ROLE_BADGE: Record<string, string> = {
  manager: 'bg-purple-100 text-purple-700',
  tl: 'bg-blue-100 text-blue-700',
  employee: 'bg-gray-100 text-gray-600',
};

export default function AgentStatsTable() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agent-stats', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load stats');
      const data = await res.json();
      setAgents(
        (data.agents ?? []).map((a: any) => ({
          ...a,
          calls: Number(a.calls),
          connected: Number(a.connected),
          success: Number(a.success),
          talkSeconds: Number(a.talkSeconds),
          loginSeconds: Number(a.loginSeconds),
        })),
      );
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Error loading stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000); // live: har 10s refresh
    return () => clearInterval(t);
  }, [load]);

  if (loading) return <p className="text-sm text-gray-500">Loading agent stats…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  const total = (key: keyof Agent) =>
    agents.reduce((s, a) => s + (a[key] as number), 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Employee</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Calls</th>
            <th className="px-4 py-3">Connected</th>
            <th className="px-4 py-3">Success</th>
            <th className="px-4 py-3">Talk time</th>
            <th className="px-4 py-3">Login hrs</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-semibold text-gray-900">{a.employee}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    ROLE_BADGE[a.role] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {ROLE_LABELS[a.role] ?? a.role}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-2 text-gray-700">
                  <span
                    className={`h-2 w-2 rounded-full ${STATUS_DOT[a.status] ?? 'bg-gray-400'}`}
                  />
                  {a.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-700">{a.calls}</td>
              <td className="px-4 py-3 text-gray-700">{a.connected}</td>
              <td className="px-4 py-3 text-gray-700">{a.success}</td>
              <td className="px-4 py-3 text-gray-700">{fmtTalk(a.talkSeconds)}</td>
              <td className="px-4 py-3 text-gray-700">{fmtHrs(a.loginSeconds)}</td>
            </tr>
          ))}
          {agents.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                No agents found.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold text-gray-900">
            <td className="px-4 py-3">Total</td>
            <td className="px-4 py-3" />
            <td className="px-4 py-3 text-gray-500">{agents.length} agents</td>
            <td className="px-4 py-3">{total('calls')}</td>
            <td className="px-4 py-3">{total('connected')}</td>
            <td className="px-4 py-3">{total('success')}</td>
            <td className="px-4 py-3">{fmtTalk(total('talkSeconds'))}</td>
            <td className="px-4 py-3">{fmtHrs(total('loginSeconds'))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
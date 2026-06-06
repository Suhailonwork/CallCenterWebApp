'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { format, parseISO } from 'date-fns';
import type { CallReportRow } from '@/types';

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function dur(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}
function when(v: string) {
  try {
    return format(parseISO(v), 'MMM d, HH:mm');
  } catch {
    return v;
  }
}

const STATUSES = [
  '', 'connected', 'no_answer', 'busy', 'voicemail', 'failed', 'wrong_number',
];

interface Summary {
  total: number;
  connected: number;
  successRate: number;
  talkSeconds: number;
}

export function ReportsView() {
  const [from, setFrom] = useState(ymd(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(ymd(new Date()));
  const [status, setStatus] = useState('');
  const [employeeId, setEmployeeId] = useState(0);
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);
  const [rows, setRows] = useState<CallReportRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  function queryString() {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (status) p.set('status', status);
    if (employeeId) p.set('employeeId', String(employeeId));
    return p.toString();
  }

  async function run() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reports?' + queryString());
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to load report');
        return;
      }
      setRows(data.rows);
      setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        if (res.ok) {
          setEmployees(
            data.users
              .filter((x: any) => x.role === 'employee')
              .map((x: any) => ({ id: x.id, name: x.name })),
          );
        }
      } catch {
        /* ignore */
      }
    })();
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportCsv() {
    window.location.href = '/api/admin/reports?format=csv&' + queryString();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Call Reports</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-500">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === '' ? 'All' : s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Employee</label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(Number(e.target.value))}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value={0}>All</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={run}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Apply
        </button>
        <button
          onClick={exportCsv}
          className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium hover:bg-slate-50"
        >
          Export CSV
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Calls</p>
            <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Connected</p>
            <p className="mt-1 text-2xl font-semibold">{summary.connected}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Success rate</p>
            <p className="mt-1 text-2xl font-semibold">{summary.successRate}%</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Talk time</p>
            <p className="mt-1 text-2xl font-semibold">{dur(summary.talkSeconds)}</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-400">No calls match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-400">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Employee</th>
                  <th className="pb-2">Phone</th>
                  <th className="pb-2">Contact</th>
                  <th className="pb-2">Campaign</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Duration</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 text-slate-500">{when(r.created_at)}</td>
                    <td className="py-2">{r.employee_name}</td>
                    <td className="py-2 font-mono text-xs">{r.phone_number}</td>
                    <td className="py-2">{r.contact_name ?? '—'}</td>
                    <td className="py-2 text-slate-500">{r.campaign_name ?? '—'}</td>
                    <td className="py-2">{r.status.replace('_', ' ')}</td>
                    <td className="py-2 text-right">{dur(r.duration_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-400">
              Showing {rows.length} call{rows.length === 1 ? '' : 's'} (max 2000).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

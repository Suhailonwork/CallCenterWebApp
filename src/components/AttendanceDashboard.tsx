'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import { Button } from '@/components/Button';
import { ShiftManager } from '@/components/ShiftManager';
import type {
  AttendanceResponse,
  AttendanceBoardRow,
  AttendanceSessionRow,
  AttendanceStatus,
} from '@/types';

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
];

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'logged_in', label: 'Logged in' },
  { value: 'logged_out', label: 'Logged out' },
  { value: 'on_time', label: 'On time' },
  { value: 'grace', label: 'Grace' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
];

const STATUS_CHIP: Record<string, string> = {
  on_time: 'bg-green-100 text-green-700',
  grace: 'bg-amber-100 text-amber-700',
  late: 'bg-red-100 text-red-700',
};

function statusLabel(s: AttendanceStatus | null): string {
  if (s === 'on_time') return 'On time';
  if (s === 'grace') return 'Grace';
  if (s === 'late') return 'Late';
  return '—';
}

function StatusChip({ status }: { status: AttendanceStatus | null }) {
  return (
    <span
      className={
        'rounded-full px-2 py-0.5 text-xs font-medium ' +
        (status ? STATUS_CHIP[status] : 'bg-slate-100 text-slate-500')
      }
    >
      {statusLabel(status)}
    </span>
  );
}

function fmtTime(v: string | null): string {
  if (!v) return '—';
  try {
    return format(parseISO(v), 'HH:mm');
  } catch {
    return v;
  }
}
function fmtDateTime(v: string | null): string {
  if (!v) return '—';
  try {
    return format(parseISO(v), 'MMM d, HH:mm');
  } catch {
    return v;
  }
}
function fmtDur(sec: number): string {
  if (!sec) return '0m';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Attendance & live login status. Shared by the Admin console (`scope=admin`,
 * sees every user + a TL filter + shift management + force logout) and the TL
 * console (`scope=tl`, restricted server-side to the TL's own agents).
 */
export function AttendanceDashboard({ scope }: { scope: 'admin' | 'tl' }) {
  const base = `/api/${scope}/attendance`;
  const isAdmin = scope === 'admin';

  const [preset, setPreset] = useState('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tlId, setTlId] = useState(0);
  const [employeeId, setEmployeeId] = useState(0);
  const [status, setStatus] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShifts, setShowShifts] = useState(false);
  // Stable scope user list for the Employee filter (full scope, unfiltered).
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);

  const queryString = useCallback(() => {
    const p = new URLSearchParams();
    p.set('preset', preset);
    if (preset === 'custom') {
      if (from) p.set('from', from);
      if (to) p.set('to', to);
    }
    if (isAdmin && tlId) p.set('tlId', String(tlId));
    if (employeeId) p.set('employeeId', String(employeeId));
    if (status) p.set('status', status);
    if (q) p.set('q', q);
    p.set('page', String(page));
    return p.toString();
  }, [preset, from, to, tlId, employeeId, status, q, page, isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${base}?${queryString()}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
        // Refresh the stable employee list only when not narrowed to one user.
        if (!employeeId && !status && !q) {
          setEmployees(
            (json.board as AttendanceBoardRow[])
              .map((b) => ({ id: b.userId, name: b.name }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          );
        }
      } else {
        toast.error(json.error ?? 'Failed to load attendance');
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-refresh live data every 15s while viewing "today".
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    if (preset !== 'today') return;
    const id = setInterval(() => void loadRef.current(), 15_000);
    return () => clearInterval(id);
  }, [preset]);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setPage(1);
      setter(v);
    };
  }

  async function forceLogout(userId: number, name: string) {
    if (!confirm(`Force logout ${name}? This closes their open attendance session.`)) return;
    const res = await fetch('/api/admin/attendance/force-logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? 'Force logout failed');
      return;
    }
    toast.success(`${name} logged out`);
    void load();
  }

  function exportCsv() {
    const p = new URLSearchParams(queryString());
    p.set('format', 'csv');
    p.delete('page');
    window.open(`${base}?${p.toString()}`, '_blank');
  }

  const summary = data?.summary;
  const cards = useMemo(
    () => [
      { label: 'Present', value: summary?.present ?? 0 },
      { label: 'Absent', value: summary?.absent ?? 0 },
      { label: 'Logged in now', value: summary?.loggedIn ?? 0, accent: 'text-green-600' },
      { label: 'Logged out', value: summary?.loggedOut ?? 0 },
      { label: 'On time', value: summary?.onTime ?? 0, accent: 'text-green-600' },
      { label: 'Late', value: summary?.late ?? 0, accent: 'text-red-600' },
      { label: 'Grace', value: summary?.grace ?? 0, accent: 'text-amber-600' },
      { label: 'Total hours', value: fmtDur(summary?.totalWorkSeconds ?? 0) },
    ],
    [summary],
  );

  const board = data?.board ?? [];
  const rows = data?.rows ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Attendance &amp; Login Tracking</h1>
          <p className="text-xs text-slate-400">
            {data ? `${data.from} → ${data.to} · Asia/Kolkata` : 'Loading…'}
            {preset === 'today' && ' · live'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Button variant="secondary" onClick={() => setShowShifts(true)}>
              Manage shifts
            </Button>
          )}
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-500">Range</label>
          <select
            value={preset}
            onChange={(e) => resetPage(setPreset)(e.target.value)}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {preset === 'custom' && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-500">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => resetPage(setFrom)(e.target.value)}
                className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => resetPage(setTo)(e.target.value)}
                className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </>
        )}

        {isAdmin && (
          <div>
            <label className="block text-xs font-medium text-slate-500">Team Lead</label>
            <select
              value={tlId}
              onChange={(e) => resetPage(setTlId)(Number(e.target.value))}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value={0}>All TLs</option>
              {(data?.tls ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-500">Employee</label>
          <select
            value={employeeId}
            onChange={(e) => resetPage(setEmployeeId)(Number(e.target.value))}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value={0}>All employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500">Status</label>
          <select
            value={status}
            onChange={(e) => resetPage(setStatus)(e.target.value)}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQ(qInput.trim());
          }}
          className="flex items-end gap-2"
        >
          <div>
            <label className="block text-xs font-medium text-slate-500">Search</label>
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Name or email…"
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" variant="secondary" loading={loading}>
            Apply
          </Button>
        </form>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className={'mt-1 text-2xl font-semibold ' + (c.accent ?? '')}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Live board */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">Live status</h2>
        {board.length === 0 ? (
          <p className="text-sm text-slate-400">No users match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-400">
                  <th className="pb-2">Employee</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">TL</th>
                  <th className="pb-2">Shift</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">First login</th>
                  <th className="pb-2">Last logout</th>
                  <th className="pb-2 text-right">Hours</th>
                  <th className="pb-2">Live</th>
                  {isAdmin && <th className="pb-2 text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {board.map((b: AttendanceBoardRow) => (
                  <tr key={b.userId} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 font-medium">
                      {b.name}
                      {!b.present && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                          absent
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-slate-500">{b.role}</td>
                    <td className="py-2 text-slate-500">{b.tlName ?? '—'}</td>
                    <td className="py-2 text-slate-500">{b.shiftName ?? '—'}</td>
                    <td className="py-2">
                      {b.present ? <StatusChip status={b.status} /> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-2 text-slate-500">{fmtTime(b.firstLogin)}</td>
                    <td className="py-2 text-slate-500">{b.online ? '—' : fmtTime(b.lastLogout)}</td>
                    <td className="py-2 text-right text-slate-500">{fmtDur(b.totalSeconds)}</td>
                    <td className="py-2">
                      {b.online ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" /> Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <span className="h-2 w-2 rounded-full bg-slate-300" /> Offline
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-2 text-right">
                        {b.online && (
                          <button
                            onClick={() => forceLogout(b.userId, b.name)}
                            className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Force logout
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Session records */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">Session records</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">No sessions in this range.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-400">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Employee</th>
                    <th className="pb-2">Login</th>
                    <th className="pb-2">Logout</th>
                    <th className="pb-2 text-right">Duration</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">IP</th>
                    <th className="pb-2">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: AttendanceSessionRow) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0 align-top">
                      <td className="py-2 whitespace-nowrap text-slate-500">{r.workDate}</td>
                      <td className="py-2 font-medium">{r.userName}</td>
                      <td className="py-2 text-slate-500">{fmtDateTime(r.loginAt)}</td>
                      <td className="py-2 text-slate-500">
                        {r.logoutAt ? (
                          fmtDateTime(r.logoutAt)
                        ) : r.online ? (
                          <span className="text-green-600">online</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 text-right text-slate-500">{fmtDur(r.durationSeconds)}</td>
                      <td className="py-2">
                        <StatusChip status={r.status} />
                      </td>
                      <td className="py-2 font-mono text-xs text-slate-400">{r.ip ?? '—'}</td>
                      <td
                        className="py-2 max-w-[14rem] truncate text-xs text-slate-400"
                        title={r.userAgent ?? ''}
                      >
                        {r.userAgent ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>
                Page {data?.page ?? page} of {totalPages} · {data?.total ?? 0} sessions
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={(data?.page ?? page) <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={(data?.page ?? page) >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {showShifts && <ShiftManager onClose={() => setShowShifts(false)} />}
    </div>
  );
}

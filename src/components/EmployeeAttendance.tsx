'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/Button';
import type { EmployeeAttendanceData, AttendanceStatus } from '@/types';

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
function fmtDur(sec: number): string {
  if (!sec) return '0m';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** The signed-in employee's own attendance: today + history. */
export function EmployeeAttendance() {
  const [data, setData] = useState<EmployeeAttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employee/attendance?page=${page}`);
      const json = await res.json();
      if (res.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep today's status fresh.
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    const id = setInterval(() => void loadRef.current(), 30_000);
    return () => clearInterval(id);
  }, []);

  const today = data?.today;
  const counts = data?.counts;
  const cards = [
    { label: "Today's login", value: fmtTime(today?.firstLogin ?? null) },
    { label: "Today's logout", value: today?.online ? 'Online' : fmtTime(today?.lastLogout ?? null) },
    { label: 'Working hours (today)', value: fmtDur(today?.totalSeconds ?? 0) },
    { label: 'On-time count', value: counts?.onTime ?? 0, accent: 'text-green-600' },
    { label: 'Late count', value: counts?.late ?? 0, accent: 'text-red-600' },
    { label: 'Grace count', value: counts?.grace ?? 0, accent: 'text-amber-600' },
  ];

  const history = data?.history ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">My Attendance</h1>
          <p className="text-sm text-slate-500">
            {data?.shift.name
              ? `Shift: ${data.shift.name}${data.shift.start ? ` · starts ${data.shift.start}` : ''}`
              : 'No shift assigned'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">Current status:</span>
          {today?.online ? (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" /> Online
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-300" /> Offline
            </span>
          )}
          {today && <StatusChip status={today.status} />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className={'mt-1 text-2xl font-semibold ' + (c.accent ?? '')}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">Attendance history</h2>
        {loading && !data ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-400">No attendance records yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-400">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Login</th>
                    <th className="pb-2">Logout</th>
                    <th className="pb-2 text-right">Duration</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Shift</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 whitespace-nowrap text-slate-500">{r.workDate}</td>
                      <td className="py-2 text-slate-500">{fmtTime(r.loginAt)}</td>
                      <td className="py-2 text-slate-500">
                        {r.logoutAt ? fmtTime(r.logoutAt) : r.online ? (
                          <span className="text-green-600">online</span>
                        ) : '—'}
                      </td>
                      <td className="py-2 text-right text-slate-500">{fmtDur(r.durationSeconds)}</td>
                      <td className="py-2">
                        <StatusChip status={r.status} />
                      </td>
                      <td className="py-2 text-slate-500">{r.shiftName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>
                Page {data?.pagination.page ?? page} of {totalPages} ·{' '}
                {data?.pagination.total ?? 0} records
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={(data?.pagination.page ?? page) <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={(data?.pagination.page ?? page) >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { EmployeeDashboard } from '@/types';
import { BreakWidget } from './BreakWidget';

function dur(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const STATUS_STYLE: Record<string, string> = {
  connected: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  no_answer: 'bg-slate-100 text-slate-600',
  busy: 'bg-amber-100 text-amber-700',
  voicemail: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
  wrong_number: 'bg-red-100 text-red-700',
};

function safeDate(value: string, pattern: string) {
  try {
    return format(parseISO(value), pattern);
  } catch {
    return value;
  }
}

export function DashboardView({
  userName,
  data,
}: {
  userName: string;
  data: EmployeeDashboard;
}) {
  const kpis = [
    { label: "Today's calls", value: data.today.calls },
    { label: 'Connected', value: data.today.connected },
    { label: 'Success rate', value: `${data.today.successRate}%` },
    { label: 'Talk time', value: dur(data.today.durationSeconds) },
    { label: 'Break time', value: dur(data.today.breakSeconds) },
    { label: 'Scheduled', value: data.scheduledCount },
  ];

  const chartData = data.chart.map((c) => ({
    day: safeDate(c.date, 'EEE'),
    Calls: c.calls,
    Connected: c.connected,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Welcome back, {userName}</h1>
        <p className="text-sm text-slate-500">Here is your performance for today.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold">{k.value}</p>
          </div>
        ))}
      </div>

      {/* 7-day chart */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">
          Calls over the last 7 days
        </h2>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Calls" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Connected" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <BreakWidget />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* recent calls */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-500">Recent calls</h2>
          {data.recentCalls.length === 0 ? (
            <p className="text-sm text-slate-400">No calls yet.</p>
          ) : (
            <div className="space-y-2">
              {data.recentCalls.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm last:border-0"
                >
                  <div>
                    <p className="font-medium">{c.contact_name ?? c.phone_number}</p>
                    <p className="text-xs text-slate-400">
                      {safeDate(c.created_at, 'MMM d, HH:mm')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s
                    </span>
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-xs font-medium ' +
                        (STATUS_STYLE[c.status] ?? 'bg-slate-100 text-slate-600')
                      }
                    >
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* scheduled calls */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-500">
            Scheduled follow-ups
          </h2>
          {data.scheduled.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing scheduled.</p>
          ) : (
            <div className="space-y-2">
              {data.scheduled.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm last:border-0"
                >
                  <div>
                    <p className="font-medium">{s.contact_name ?? s.phone_number}</p>
                    <p className="text-xs text-slate-400">{s.phone_number}</p>
                  </div>
                  <span className="text-xs font-medium text-indigo-600">
                    {safeDate(s.scheduled_at, 'MMM d, HH:mm')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

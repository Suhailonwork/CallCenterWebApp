// 'use client';

// import { format, parseISO } from 'date-fns';
// import type { EmployeeDashboard } from '@/types';
// import { BreakWidget } from './BreakWidget';
// import { Dialer } from './Dialer';

// function dur(sec: number) {
//   const h = Math.floor(sec / 3600);
//   const m = Math.floor((sec % 3600) / 60);
//   return h > 0 ? `${h}h ${m}m` : `${m}m`;
// }

// const STATUS_STYLE: Record<string, string> = {
//   connected: 'bg-green-100 text-green-700',
//   completed: 'bg-green-100 text-green-700',
//   no_answer: 'bg-slate-100 text-slate-600',
//   busy: 'bg-amber-100 text-amber-700',
//   voicemail: 'bg-blue-100 text-blue-700',
//   failed: 'bg-red-100 text-red-700',
//   wrong_number: 'bg-red-100 text-red-700',
// };

// function safeDate(value: string, pattern: string) {
//   try {
//     return format(parseISO(value), pattern);
//   } catch {
//     return value;
//   }
// }

// export function DashboardView({
//   userName,
//   data,
// }: {
//   userName: string;
//   data: EmployeeDashboard;
// }) {
//   const kpis = [
//     { label: "Today's calls", value: data.today.calls },
//     { label: 'Connected', value: data.today.connected },
//     { label: 'Success rate', value: `${data.today.successRate}%` },
//     { label: 'Talk time', value: dur(data.today.durationSeconds) },
//     { label: 'Break time', value: dur(data.today.breakSeconds) },
//     { label: 'Scheduled', value: data.scheduledCount },
//   ];

//   const chartData = data.chart.map((c) => ({
//     day: safeDate(c.date, 'EEE'),
//     Calls: c.calls,
//     Connected: c.connected,
//   }));

//   return (
//     <div className="mx-auto max-w-5xl space-y-6">
//       <div>
//         <h1 className="text-xl font-semibold">Welcome back, {userName}</h1>
//         <p className="text-sm text-slate-500">Here is your performance for today.</p>
//       </div>

//       {/* KPI cards */}
//       <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
//         {kpis.map((k) => (
//           <div key={k.label} className="rounded-xl bg-white p-4 shadow-sm">
//             <p className="text-xs font-medium text-slate-500">{k.label}</p>
//             <p className="mt-1 text-2xl font-semibold">{k.value}</p>
//           </div>
//         ))}
//       </div>

// <Dialer/>
     

//       <BreakWidget />

//       <div className="grid gap-4 lg:grid-cols-2">
//         {/* recent calls */}
//         <div className="rounded-2xl bg-white p-5 shadow-sm">
//           <h2 className="mb-3 text-sm font-semibold text-slate-500">Recent calls</h2>
//           {data.recentCalls.length === 0 ? (
//             <p className="text-sm text-slate-400">No calls yet.</p>
//           ) : (
//             <div className="space-y-2">
//               {data.recentCalls.map((c) => (
//                 <div
//                   key={c.id}
//                   className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm last:border-0"
//                 >
//                   <div>
//                     <p className="font-medium">{c.contact_name ?? c.phone_number}</p>
//                     <p className="text-xs text-slate-400">
//                       {safeDate(c.created_at, 'MMM d, HH:mm')}
//                     </p>
//                   </div>
//                   <div className="flex items-center gap-3">
//                     <span className="text-xs text-slate-500">
//                       {Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s
//                     </span>
//                     <span
//                       className={
//                         'rounded-full px-2 py-0.5 text-xs font-medium ' +
//                         (STATUS_STYLE[c.status] ?? 'bg-slate-100 text-slate-600')
//                       }
//                     >
//                       {c.status.replace('_', ' ')}
//                     </span>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>

//         {/* scheduled calls */}
//         <div className="rounded-2xl bg-white p-5 shadow-sm">
//           <h2 className="mb-3 text-sm font-semibold text-slate-500">
//             Scheduled follow-ups
//           </h2>
//           {data.scheduled.length === 0 ? (
//             <p className="text-sm text-slate-400">Nothing scheduled.</p>
//           ) : (
//             <div className="space-y-2">
//               {data.scheduled.map((s) => (
//                 <div
//                   key={s.id}
//                   className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm last:border-0"
//                 >
//                   <div>
//                     <p className="font-medium">{s.contact_name ?? s.phone_number}</p>
//                     <p className="text-xs text-slate-400">{s.phone_number}</p>
//                   </div>
//                   <span className="text-xs font-medium text-indigo-600">
//                     {safeDate(s.scheduled_at, 'MMM d, HH:mm')}
//                   </span>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }


'use client';

import { format, parseISO, formatDistanceToNow } from 'date-fns';
import {
  Phone,
  PhoneCall,
  TrendingUp,
  Clock,
  Coffee,
  CalendarClock,
  PhoneIncoming,
  PhoneOff,
  Voicemail,
  PhoneMissed,
} from 'lucide-react';
import type { EmployeeDashboard } from '@/types';
import { BreakWidget } from './BreakWidget';
import { Dialer } from './Dialer';

function dur(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function safeDate(value: string, pattern: string) {
  try {
    return format(parseISO(value), pattern);
  } catch {
    return value;
  }
}

function safeRelative(value: string) {
  try {
    return formatDistanceToNow(parseISO(value), { addSuffix: true });
  } catch {
    return value;
  }
}

// initials from a name or phone fallback
function initials(name: string | null | undefined, fallback: string) {
  if (!name) return fallback.slice(-2);
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const STATUS_STYLE: Record<
  string,
  { label: string; dot: string; pill: string }
> = {
  connected: {
    label: 'Connected',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  },
  completed: {
    label: 'Completed',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  },
  no_answer: {
    label: 'No answer',
    dot: 'bg-slate-400',
    pill: 'bg-slate-50 text-slate-600 ring-slate-500/20',
  },
  busy: {
    label: 'Busy',
    dot: 'bg-amber-500',
    pill: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  },
  voicemail: {
    label: 'Voicemail',
    dot: 'bg-blue-500',
    pill: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  },
  failed: {
    label: 'Failed',
    dot: 'bg-rose-500',
    pill: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  },
  wrong_number: {
    label: 'Wrong number',
    dot: 'bg-rose-500',
    pill: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  },
};

export function DashboardView({
  userName,
  data,
}: {
  userName: string;
  data: EmployeeDashboard;
}) {
  const kpis = [
    {
      label: "Today's calls",
      value: data.today.calls,
      icon: Phone,
      tint: 'text-indigo-600 bg-indigo-50',
    },
    {
      label: 'Connected',
      value: data.today.connected,
      icon: PhoneCall,
      tint: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Success rate',
      value: `${data.today.successRate}%`,
      icon: TrendingUp,
      tint: 'text-violet-600 bg-violet-50',
    },
    {
      label: 'Talk time',
      value: dur(data.today.durationSeconds),
      icon: Clock,
      tint: 'text-sky-600 bg-sky-50',
    },
    {
      label: 'Break time',
      value: dur(data.today.breakSeconds),
      icon: Coffee,
      tint: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Scheduled',
      value: data.scheduledCount,
      icon: CalendarClock,
      tint: 'text-rose-600 bg-rose-50',
    },
  ];

  const today = new Date();

  return (
    // Wide on purpose: the dialer's customer panel below wants the whole
    // screen, and the KPI row simply breathes more at this width.
    <div className="mx-auto w-full max-w-[1700px] space-y-6 px-1">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Welcome back, <span className="text-indigo-600">{userName}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {format(today, 'EEEE, MMMM d')} · Here's your performance today.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          On shift
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map(({ label, value, icon: Icon, tint }) => (
          <div
            key={label}
            className="group relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-300"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg ${tint}`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Dialer */}
      <Dialer />

      {/* Break widget */}
      <BreakWidget />

      {/* Recent + Scheduled */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* recent calls */}
        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <PhoneIncoming className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">
                Recent calls
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              {data.recentCalls.length} total
            </span>
          </header>

          <div className="px-2 py-2">
            {data.recentCalls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <PhoneOff className="h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-400">No calls yet today.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recentCalls.map((c) => {
                  const status = STATUS_STYLE[c.status] ?? {
                    label: c.status.replace('_', ' '),
                    dot: 'bg-slate-400',
                    pill: 'bg-slate-50 text-slate-600 ring-slate-500/20',
                  };
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                    >
                      {/* Avatar */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-xs font-semibold text-indigo-700">
                        {initials(c.contact_name, c.phone_number)}
                      </div>

                      {/* Name + time */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {c.contact_name ?? c.phone_number}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {c.contact_name ? `${c.phone_number} · ` : ''}
                          {safeDate(c.created_at, 'MMM d, HH:mm')}
                        </p>
                      </div>

                      {/* Duration + status */}
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="tabular-nums text-xs text-slate-500">
                          {Math.floor(c.duration_seconds / 60)}m{' '}
                          {c.duration_seconds % 60}s
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${status.pill}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                          />
                          {status.label}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* scheduled calls */}
        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">
                Scheduled follow-ups
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              {data.scheduled.length} upcoming
            </span>
          </header>

          <div className="px-2 py-2">
            {data.scheduled.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CalendarClock className="h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-400">
                  Nothing scheduled.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.scheduled.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-amber-100 text-xs font-semibold text-rose-700">
                      {initials(s.contact_name, s.phone_number)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {s.contact_name ?? s.phone_number}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {s.phone_number}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span className="text-xs font-semibold text-indigo-600">
                        {safeDate(s.scheduled_at, 'MMM d, HH:mm')}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {safeRelative(s.scheduled_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

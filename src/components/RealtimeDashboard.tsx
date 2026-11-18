'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import {
  LayoutDashboard,
  PhoneIncoming,
  PhoneOutgoing,
  Trophy,
  PhoneMissed,
  ListChecks,
  Database,
  Users,
  CircleDashed,
} from 'lucide-react';
import { useSocketEvent } from '@/lib/useSocket';

/* ------------------------------------------------------------------ types -- */

interface Dashboard {
  asOf: string;
  engineRunning: boolean;
  agents: {
    loggedIn: number;
    onCall: number;
    ready: number;
    pausedWrap: number;
    live: boolean;
  };
  inbound: { answered: number; unanswered: number; ringing: number };
  outbound: { answered: number; unanswered: number; ringing: number };
  topAgents: { name: string; calls: number }[];
  dispositions: { code: string; n: number }[];
  abandoned7d: { date: string; abandoned: number }[];
  leads: { total: number; toBeDialled: number; dialled: number; queueNow: number };
}

/* ----------------------------------------------------------------- colors -- */

const GREEN = '#22c55e';
const CORAL = '#f87171';
const BLUE = '#6366f1';

// Stable, readable palette for disposition slices.
const DISPO_PALETTE = [
  '#6366f1', '#22c55e', '#f87171', '#a16207', '#7c3aed',
  '#0d9488', '#f59e0b', '#ec4899', '#64748b', '#0ea5e9',
  '#84cc16', '#d946ef',
];

/* --------------------------------------------------------------- helpers --- */

function fmt(n: number) {
  return n.toLocaleString();
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function clock(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* ------------------------------------------------------------- primitives -- */

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <span className="text-indigo-500">{icon}</span>
        {title}
      </h2>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/** A donut with a value + caption stacked in the hole. */
function Donut({
  data,
  center,
  caption,
}: {
  data: { name: string; value: number; color: string }[];
  center: string;
  caption: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative mx-auto h-44 w-44">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={total === 0 ? [{ name: 'none', value: 1, color: '#e2e8f0' }] : data}
            dataKey="value"
            innerRadius="68%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            paddingAngle={total === 0 ? 0 : 2}
            stroke="none"
            isAnimationActive={false}
          >
            {(total === 0 ? [{ color: '#e2e8f0' }] : data).map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-slate-900">{center}</span>
        <span className="text-xs text-slate-400">{caption}</span>
      </div>
    </div>
  );
}

function LegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
      <span className="text-slate-600">{label}</span>
      <span className="ml-auto font-semibold tabular-nums text-slate-800">{fmt(value)}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- tiles ---- */

function AgentTile({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: 'blue' | 'amber' | 'green' | 'red';
}) {
  const tones = {
    blue: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-rose-50 text-rose-600',
  }[tone];
  return (
    <div className={`rounded-xl p-4 ${tones}`}>
      <div className="text-3xl font-bold tabular-nums">{fmt(value)}</div>
      <div className="mt-1 text-xs font-medium opacity-80">{label}</div>
    </div>
  );
}

/* -------------------------------------------------------------- component -- */

export function RealtimeDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async (background = false) => {
    if (inFlight.current || (background && document.hidden)) return;
    inFlight.current = true;
    try {
      const res = await fetch('/api/admin/dashboard-live', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Failed to load dashboard');
        return;
      }
      setData(json);
      setError(null);
    } catch {
      setError('Network error');
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
  }, [load]);

  // Any server-side change to calls/dialer state refreshes the view at once,
  // so the dashboard reacts the moment something happens, not on the next tick.
  useSocketEvent('data-changed', () => load(true));
  // Agent presence (logged in / on call / ready / wrap) changes the instant an
  // agent connects, disconnects, or switches state — refresh on that too.
  useSocketEvent('agents-updated', () => load(true));

  if (error && !data) {
    return (
      <div className="rounded-2xl bg-white p-6 text-sm text-rose-600 shadow-sm ring-1 ring-slate-200/60">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl bg-white p-6 text-sm text-slate-400 shadow-sm ring-1 ring-slate-200/60">
        Loading live dashboard…
      </div>
    );
  }

  const inboundTotal =
    data.inbound.answered + data.inbound.unanswered + data.inbound.ringing;
  const outboundTotal =
    data.outbound.answered + data.outbound.unanswered + data.outbound.ringing;
  const connectedTotal = data.dispositions.reduce((s, d) => s + d.n, 0);

  // Always render 7 day buckets for the abandoned chart, filling gaps with 0.
  const byDate = new Map(data.abandoned7d.map((r) => [r.date.slice(0, 10), r.abandoned]));
  const days: { label: string; abandoned: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    days.push({ label: `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, abandoned: byDate.get(key) ?? 0 });
  }

  const dialledPct =
    data.leads.total > 0 ? Math.round((data.leads.dialled / data.leads.total) * 100) : 0;
  const toDialPct =
    data.leads.total > 0 ? Math.round((data.leads.toBeDialled / data.leads.total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <LayoutDashboard className="h-6 w-6 text-indigo-600" />
          Real-Time Dashboard
        </h1>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Updated {clock(data.asOf)}
        </div>
      </div>

      {/* top row */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {/* agent status */}
        <Card icon={<Users className="h-4 w-4" />} title="Agent Status">
          <div className="grid grid-cols-2 gap-3">
            <AgentTile value={data.agents.loggedIn} label="Logged in" tone="blue" />
            <AgentTile value={data.agents.onCall} label="On call" tone="amber" />
            <AgentTile value={data.agents.ready} label="Idle / ready" tone="green" />
            <AgentTile value={data.agents.pausedWrap} label="Paused / wrap" tone="red" />
          </div>
        </Card>

        {/* inbound */}
        <Card icon={<PhoneIncoming className="h-4 w-4" />} title="Inbound Calls (today)">
          <div className="flex h-full flex-col items-center gap-4">
            <Donut
              center={fmt(inboundTotal)}
              caption="inbound"
              data={[
                { name: 'Answered', value: data.inbound.answered, color: GREEN },
                { name: 'Unanswered', value: data.inbound.unanswered, color: CORAL },
              ]}
            />
            <div className="w-full space-y-2">
              <LegendRow color={GREEN} label="Answered" value={data.inbound.answered} />
              <LegendRow color={CORAL} label="Unanswered" value={data.inbound.unanswered} />
              <LegendRow color={BLUE} label="Ringing now" value={data.inbound.ringing} />
            </div>
          </div>
        </Card>

        {/* outbound */}
        <Card icon={<PhoneOutgoing className="h-4 w-4" />} title="Outbound Calls (today)">
          <div className="flex h-full flex-col items-center gap-4">
            <Donut
              center={fmt(outboundTotal)}
              caption="outbound"
              data={[
                { name: 'Answered', value: data.outbound.answered, color: GREEN },
                { name: 'Unanswered', value: data.outbound.unanswered, color: CORAL },
                { name: 'Ringing', value: data.outbound.ringing, color: BLUE },
              ]}
            />
            <div className="w-full space-y-2">
              <LegendRow color={GREEN} label="Answered" value={data.outbound.answered} />
              <LegendRow color={CORAL} label="Unanswered" value={data.outbound.unanswered} />
              <LegendRow color={BLUE} label="Ringing now" value={data.outbound.ringing} />
            </div>
          </div>
        </Card>

        {/* top agents */}
        <Card icon={<Trophy className="h-4 w-4" />} title="Top Agents (calls today)">
          {data.topAgents.length === 0 ? (
            <p className="text-sm text-slate-400">No calls yet today.</p>
          ) : (
            <ol className="space-y-1">
              {data.topAgents.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0"
                >
                  <span className="w-4 text-sm font-semibold text-slate-400 tabular-nums">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm text-slate-700">{a.name}</span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {fmt(a.calls)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* bottom row */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {/* dispositions */}
        <Card icon={<CircleDashed className="h-4 w-4" />} title="Dispositions (today)">
          <div className="flex h-full flex-col items-center gap-4">
            <Donut
              center={fmt(connectedTotal)}
              caption="connected"
              data={data.dispositions.map((d, i) => ({
                name: d.code,
                value: d.n,
                color: DISPO_PALETTE[i % DISPO_PALETTE.length],
              }))}
            />
            <div className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5">
              {data.dispositions.length === 0 ? (
                <p className="col-span-2 text-sm text-slate-400">No dispositions yet.</p>
              ) : (
                data.dispositions.map((d, i) => (
                  <LegendRow
                    key={d.code}
                    color={DISPO_PALETTE[i % DISPO_PALETTE.length]}
                    label={d.code}
                    value={d.n}
                  />
                ))
              )}
            </div>
          </div>
        </Card>

        {/* abandoned rate */}
        <Card icon={<PhoneMissed className="h-4 w-4" />} title="Abandoned Rate (7 days)">
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days} margin={{ top: 20, right: 6, left: 6, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Bar dataKey="abandoned" fill={CORAL} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  <LabelList
                    dataKey="abandoned"
                    position="top"
                    style={{ fontSize: 11, fill: '#64748b' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* calls in queue */}
        <Card icon={<ListChecks className="h-4 w-4" />} title="Calls in Queue">
          <div className="flex h-full flex-col items-center justify-center py-4">
            <span className="text-5xl font-bold tabular-nums text-indigo-600">
              {fmt(data.leads.queueNow)}
            </span>
            <span className="mt-2 text-sm text-slate-400">waiting to be dialled</span>
          </div>
        </Card>

        {/* leads status */}
        <Card icon={<Database className="h-4 w-4" />} title="Leads Status">
          <div className="space-y-5 py-1">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-600">Dialled</span>
                <span className="font-semibold tabular-nums text-slate-800">
                  {fmt(data.leads.dialled)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${dialledPct}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-600">To be dialled</span>
                <span className="font-semibold tabular-nums text-slate-800">
                  {fmt(data.leads.toBeDialled)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-rose-400"
                  style={{ width: `${Math.max(toDialPct, data.leads.toBeDialled > 0 ? 2 : 0)}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  PhoneCall,
  Radio,
  Router,
  Users,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

interface LiveCall {
  attemptId: string;
  campaignId: number;
  leadId: number;
  callId: number | null;
  phone: string;
  contactName: string | null;
  gatewayId: number | null;
  agentId: number | null;
  state: string;
  source: string;
  ageSec: number;
}

interface LiveAgent {
  id: number;
  name: string;
  extension: string | null;
  campaignId: number | null;
  agentState: string;
  since: number;
  pauseReason: string | null;
}

interface CampaignRow {
  id: number;
  name: string;
  status: string;
  dialer_type: string;
  dial_ratio: string | number;
  leads: number;
  fresh: number;
  waiting_retry: number;
  in_flight: number;
  finished: number;
  due_callbacks: number;
  live: number;
  ready: number;
  incall: number;
  wrapup: number;
  pause: number;
  abandon_pct: number;
}

interface GatewayRow {
  id: number;
  name: string;
  ip: string;
  channels: number;
  status: string;
  priority: number;
  fail_count: number;
  asterisk_endpoint: string | null;
  calls_today: number;
  connected_today: number;
  in_use: number;
  live_reachable: boolean;
  endpoint_state: string;
  cooldown_ms_left: number;
}

interface Payload {
  engine: {
    running: boolean;
    enabled: boolean;
    ariConnected: boolean;
    tickMs: number | null;
    activeCalls: number;
  };
  calls: LiveCall[];
  agents: LiveAgent[];
  campaigns: CampaignRow[];
  gateways: GatewayRow[];
  today: { status: string; count: number }[];
  hourly: {
    hour: number;
    attempts: number;
    connected: number;
    abandoned: number;
    talkSeconds: number;
  }[];
}

const AGENT_STYLE: Record<string, string> = {
  READY: "bg-emerald-100 text-emerald-700",
  INCALL: "bg-indigo-100 text-indigo-700",
  WRAPUP: "bg-amber-100 text-amber-700",
  PAUSE: "bg-slate-100 text-slate-600",
};

const CALL_STYLE: Record<string, string> = {
  dialing: "bg-sky-100 text-sky-700",
  ringing: "bg-violet-100 text-violet-700",
  answered: "bg-amber-100 text-amber-700",
  connected: "bg-emerald-100 text-emerald-700",
};

const STATUS_STYLE: Record<string, string> = {
  CONNECTED: "bg-emerald-500",
  NO_ANSWER: "bg-slate-400",
  BUSY: "bg-amber-500",
  FAILED: "bg-rose-500",
  VOICEMAIL: "bg-violet-500",
  CANCELLED: "bg-orange-500",
  COMPLETED: "bg-indigo-500",
};

function fmtAge(sec: number) {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone = "slate",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "slate" | "emerald" | "rose" | "indigo";
}) {
  const tones: Record<string, string> = {
    slate: "text-slate-900",
    emerald: "text-emerald-600",
    rose: "text-rose-600",
    indigo: "text-indigo-600",
  };
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/**
 * Live view of the predictive dialer: what is on the wire right now, where
 * every agent is in the state machine, how the gateways are loaded, and how
 * the campaigns' lead queues are draining.
 */
export function DialerDashboard() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dialer/live", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to load dialer state");
        return;
      }
      setData(json);
      setError(null);
    } catch {
      setError("Network error");
    }
  }, []);

  useEffect(() => {
    load();
    if (paused) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load, paused]);

  if (error && !data) {
    return (
      <div className="rounded-2xl bg-rose-50 p-5 text-sm text-rose-700 ring-1 ring-rose-200">
        {error}
      </div>
    );
  }
  if (!data) {
    return <p className="text-sm text-slate-400">Loading dialer state…</p>;
  }

  const agents = data.agents ?? [];
  const ready = agents.filter((a) => a.agentState === "READY").length;
  const incall = agents.filter((a) => a.agentState === "INCALL").length;
  const wrapup = agents.filter((a) => a.agentState === "WRAPUP").length;
  const todayTotal = data.today.reduce((n, r) => n + r.count, 0);
  const todayConnected = data.today.find((r) => r.status === "CONNECTED")?.count ?? 0;
  const connectPct = todayTotal > 0 ? Math.round((todayConnected / todayTotal) * 100) : 0;
  const maxHour = Math.max(1, ...data.hourly.map((h) => h.attempts));

  return (
    <div className="space-y-4">
      {/* Engine health */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Activity className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              Live dialer
            </h1>
            <p className="text-xs text-slate-500">
              {data.engine.running
                ? `Engine running · tick ${data.engine.tickMs}ms`
                : "Engine not running in this process"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset " +
              (data.engine.ariConnected
                ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                : "bg-rose-50 text-rose-700 ring-rose-600/20")
            }
          >
            <span
              className={
                "h-1.5 w-1.5 rounded-full " +
                (data.engine.ariConnected ? "bg-emerald-500" : "bg-rose-500 animate-pulse")
              }
            />
            {data.engine.ariConnected ? "Asterisk connected" : "Asterisk down"}
          </span>
          {!data.engine.enabled && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
              <AlertTriangle className="h-3.5 w-3.5" />
              Dialing disabled (dialer_enabled = 0)
            </span>
          )}
          <button
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
          >
            <RefreshCw className={"h-3.5 w-3.5 " + (paused ? "" : "animate-spin")} />
            {paused ? "Resume" : "Auto-refresh"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<PhoneCall className="h-3.5 w-3.5" />}
          label="Calls on the wire"
          value={data.calls.length}
          hint={`${data.calls.filter((c) => c.state === "connected").length} talking`}
          tone="indigo"
        />
        <Stat
          icon={<Users className="h-3.5 w-3.5" />}
          label="Agents"
          value={`${ready} ready`}
          hint={`${incall} in call · ${wrapup} wrap-up · ${agents.length} signed on`}
          tone="emerald"
        />
        <Stat
          icon={<Radio className="h-3.5 w-3.5" />}
          label="Attempts today"
          value={todayTotal}
          hint={`${connectPct}% connected`}
        />
        <Stat
          icon={<Router className="h-3.5 w-3.5" />}
          label="Gateway channels"
          value={data.gateways.reduce((n, g) => n + g.in_use, 0)}
          hint={`${data.gateways.filter((g) => g.live_reachable).length}/${data.gateways.length} reachable`}
        />
      </div>

      {/* Calls in flight */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Calls in flight</h2>
        {data.calls.length === 0 ? (
          <p className="text-sm text-slate-400">No calls on the wire right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 font-semibold">Contact</th>
                  <th className="pb-2 font-semibold">State</th>
                  <th className="pb-2 font-semibold">Source</th>
                  <th className="pb-2 font-semibold">Agent</th>
                  <th className="pb-2 font-semibold">Gateway</th>
                  <th className="pb-2 text-right font-semibold">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.calls.map((c) => {
                  const agent = agents.find((a) => a.id === c.agentId);
                  const gw = data.gateways.find((g) => g.id === c.gatewayId);
                  return (
                    <tr key={c.attemptId}>
                      <td className="py-2">
                        <span className="font-mono text-xs">{c.phone}</span>
                        {c.contactName && (
                          <span className="ml-2 text-xs text-slate-500">{c.contactName}</span>
                        )}
                      </td>
                      <td className="py-2">
                        <span
                          className={
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                            (CALL_STYLE[c.state] ?? "bg-slate-100 text-slate-600")
                          }
                        >
                          {c.state}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-slate-500">{c.source}</td>
                      <td className="py-2 text-xs text-slate-600">{agent?.name ?? "—"}</td>
                      <td className="py-2 text-xs text-slate-600">{gw?.name ?? "—"}</td>
                      <td className="py-2 text-right font-mono text-xs tabular-nums text-slate-500">
                        {fmtAge(c.ageSec)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Agents */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Agent states</h2>
          {agents.length === 0 ? (
            <p className="text-sm text-slate-400">No agents signed on.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {agents.map((a) => (
                <span
                  key={a.id}
                  title={a.pauseReason ?? undefined}
                  className={
                    "rounded-full px-3 py-1 text-xs font-medium " +
                    (AGENT_STYLE[a.agentState] ?? "bg-slate-100 text-slate-600")
                  }
                >
                  {a.name}
                  {a.extension ? ` (${a.extension})` : ""} · {a.agentState}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Gateways */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Gateways</h2>
          <div className="space-y-2">
            {data.gateways.map((g) => {
              const cap = g.channels > 0 ? g.channels : null;
              const pct = cap ? Math.min(100, (g.in_use / cap) * 100) : g.in_use > 0 ? 100 : 0;
              return (
                <div key={g.id} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700">
                      {g.name}
                      <span className="ml-1.5 font-normal text-slate-400">
                        {g.asterisk_endpoint ?? "not provisioned"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-slate-500">
                        {g.in_use}/{cap ?? "∞"} ch
                      </span>
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                          (g.live_reachable
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700")
                        }
                      >
                        {g.live_reachable ? g.endpoint_state : "down"}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={
                        "h-full rounded-full " +
                        (g.live_reachable ? "bg-indigo-500" : "bg-rose-400")
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {g.calls_today} attempts today · {g.connected_today} connected
                    {g.fail_count > 0 && ` · ${g.fail_count} recent failures`}
                    {g.cooldown_ms_left > 0 &&
                      ` · cooling down ${Math.ceil(g.cooldown_ms_left / 1000)}s`}
                  </p>
                </div>
              );
            })}
            {data.gateways.length === 0 && (
              <p className="text-sm text-slate-400">No gateways configured.</p>
            )}
          </div>
        </div>
      </div>

      {/* Campaign queues */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Campaign queues</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 font-semibold">Campaign</th>
                <th className="pb-2 font-semibold">Mode</th>
                <th className="pb-2 text-right font-semibold">Ratio</th>
                <th className="pb-2 text-right font-semibold">Agents</th>
                <th className="pb-2 text-right font-semibold">Live</th>
                <th className="pb-2 text-right font-semibold">Fresh</th>
                <th className="pb-2 text-right font-semibold">Retry queue</th>
                <th className="pb-2 text-right font-semibold">Callbacks</th>
                <th className="pb-2 text-right font-semibold">Done</th>
                <th className="pb-2 text-right font-semibold">Abandon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="py-2 font-medium text-slate-800">{c.name}</td>
                  <td className="py-2 text-xs text-slate-500">{c.dialer_type}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">
                    {Number(c.dial_ratio).toFixed(1)}
                  </td>
                  <td className="py-2 text-right text-xs tabular-nums text-slate-600">
                    {c.ready}R / {c.incall}C / {c.wrapup}W
                  </td>
                  <td className="py-2 text-right tabular-nums text-indigo-600">{c.live}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">{c.fresh}</td>
                  <td className="py-2 text-right tabular-nums text-amber-600">
                    {c.waiting_retry}
                  </td>
                  <td className="py-2 text-right tabular-nums text-violet-600">
                    {c.due_callbacks}
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-400">{c.finished}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">
                    {Number(c.abandon_pct).toFixed(1)}%
                  </td>
                </tr>
              ))}
              {data.campaigns.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-3 text-sm text-slate-400">
                    No active campaigns.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Outcome mix */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Today&apos;s outcomes
          </h2>
          {todayTotal === 0 ? (
            <p className="text-sm text-slate-400">No calls yet today.</p>
          ) : (
            <div className="space-y-1.5">
              {data.today
                .slice()
                .sort((a, b) => b.count - a.count)
                .map((r) => (
                  <div key={r.status} className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 font-medium text-slate-600">
                      {r.status}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={
                          "h-full rounded-full " +
                          (STATUS_STYLE[r.status] ?? "bg-slate-400")
                        }
                        style={{ width: `${(r.count / todayTotal) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right tabular-nums text-slate-500">
                      {r.count}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Hourly */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Attempts per hour</h2>
          {data.hourly.length === 0 ? (
            <p className="text-sm text-slate-400">No calls yet today.</p>
          ) : (
            <div className="flex h-32 items-end gap-1">
              {data.hourly.map((h) => (
                <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-indigo-500/80"
                    style={{ height: `${(h.attempts / maxHour) * 100}%` }}
                    title={`${h.attempts} attempts · ${h.connected} connected · ${h.abandoned} abandoned`}
                  />
                  <span className="text-[9px] text-slate-400">{h.hour}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

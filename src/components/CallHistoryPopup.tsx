"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useEscapeKey } from "@/lib/useEscapeKey";
import type { CustomerHistoryResult } from "@/lib/customerHistory";

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const STATUS_BADGE: Record<string, string> = {
  connected: "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  no_answer: "bg-amber-100 text-amber-700",
  busy: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-600",
  abandoned: "bg-red-100 text-red-600",
  wrong_number: "bg-red-100 text-red-600",
};

/**
 * The agent's view of a customer's past calls: when, which agent, the result,
 * the disposition and reason, and the note. Sits above the wrap-up screen so it
 * can be read while choosing a disposition.
 */
export function CallHistoryPopup({
  phone,
  name,
  onClose,
}: {
  phone: string;
  name?: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<CustomerHistoryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(true, onClose);

  useEffect(() => {
    let stale = false;
    setData(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/employee/customers/${encodeURIComponent(phone)}/history`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (stale) return;
        if (!res.ok) throw new Error(json.error ?? "Could not load history");
        setData(json);
      } catch (e: any) {
        if (!stale) setError(e?.message ?? "Could not load history");
      }
    })();
    return () => {
      stale = true;
    };
  }, [phone]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">Call history</h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {name ? name + " · " : ""}
              <span className="font-mono">{phone}</span>
            </p>
            {data && data.total > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                {data.total} {data.total === 1 ? "call" : "calls"} · {data.connected} connected · talk{" "}
                {fmtTime(data.talk_seconds)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5 overflow-y-auto px-5 py-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!error && !data && <p className="text-sm text-slate-400">Loading…</p>}
          {data && data.calls.length === 0 && (
            <p className="text-sm text-slate-400">No earlier calls to this customer.</p>
          )}
          {data?.calls.map((c, i) => (
            <div key={`${c.id}-${i}`} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs font-medium tabular-nums text-slate-700">{c.started_at ?? "—"}</span>
                <span className="text-xs text-slate-500">{c.agent ?? "No agent"}</span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[c.status] ?? "bg-slate-100 text-slate-600"}`}
                >
                  {c.status.replace(/_/g, " ")}
                </span>
                <span className="text-xs tabular-nums text-slate-500">{fmtTime(c.duration_seconds)}</span>
              </div>
              {c.disposition && (
                <p className="mt-1.5 text-sm">
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    {c.disposition}
                  </span>
                  {c.reason && <span className="ml-2 text-slate-700">{c.reason}</span>}
                </p>
              )}
              {c.note && <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-800">{c.note}</p>}
              {(c.amount || c.pay_date || c.pay_mode) && (
                <p className="mt-1.5 text-xs text-slate-600">
                  Payment: {[c.amount, c.pay_date, c.pay_mode].filter(Boolean).join(" · ")}
                </p>
              )}
              {c.follow_up_at && <p className="mt-1 text-xs text-slate-600">Follow-up: {c.follow_up_at}</p>}
              {c.campaign && <p className="mt-1 text-[11px] text-slate-400">{c.campaign}</p>}
            </div>
          ))}
          {data && data.total > data.calls.length && (
            <p className="text-center text-xs text-slate-400">Showing the latest {data.calls.length} entries.</p>
          )}
        </div>
      </div>
    </div>
  );
}

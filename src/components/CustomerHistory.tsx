"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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
  voicemail: "bg-slate-100 text-slate-600",
  wrong_number: "bg-red-100 text-red-600",
};

/**
 * Customer call history (notes, dispo, recordings) for one phone number.
 * Shared by the Admin and TL consoles:
 *   Admin: apiBase="/api/admin" — all calls.
 *   TL:    apiBase="/api/tl"    — only calls in the TL's group campaigns.
 */
export function CustomerHistory({
  apiBase = "/api/admin",
}: {
  apiBase?: string;
} = {}) {
  const { phone } = useParams<{ phone: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/customers/${phone}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "Failed to load");
        }
        setData(await res.json());
      } catch (e: any) {
        setError(e?.message ?? "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [phone, apiBase]);

  if (loading) return <p className="p-6 text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!data) return null;

  const { info, byAgent, calls } = data;
  const n = (v: any) => Number(v ?? 0);

  return (
    <div className="space-y-6 p-1 overflow-x-hidden">
      <button
        onClick={() => router.back()}
        className="text-sm text-indigo-600 hover:underline"
      >
        ← Back
      </button>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-xs text-slate-400">Customer</p>
        <h1 className="text-xl font-bold text-slate-900">
          {info.contact_name || info.phone_number}
        </h1>
        <p className="text-sm text-slate-500">{info.phone_number}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total calls", value: n(info.total_calls) },
          { label: "Connected", value: n(info.connected) },
          { label: "Success", value: n(info.success) },
          { label: "Total talk", value: fmtTime(n(info.talk_seconds)) },
        ].map((t) => (
          <div key={t.label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{t.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Called by ({byAgent.length} agent{byAgent.length !== 1 ? "s" : ""})
        </h2>
        <div className="flex flex-wrap gap-2">
          {byAgent.map((a: any) => (
            <div
              key={a.agent_id ?? "unknown"}
              className="rounded-xl border border-slate-200 px-4 py-2"
            >
              <p className="font-medium text-slate-800">
                {a.agent_name ?? "Unknown"}
              </p>
              <p className="text-xs text-slate-500">
                {n(a.calls)} calls · {n(a.success)} success ·{" "}
                {fmtTime(n(a.talk_seconds))}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Call history ({calls.length})
        </h2>
        <div className="overflow-x-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Agent</th>
                <th className="px-3 py-2">Campaign</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">DISPO</th>
                <th className="px-3 py-2">NOTES</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Recording</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c: any) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {c.started_at ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {c.agent_name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {c.campaign_name ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.status] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {c.dispo ? (
                      <div className="group relative inline-block">
                        <span className="inline-block cursor-help rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                          {c.dispo}
                        </span>

                        {(() => {
                          const raw = (c.note || "").trim();
                          const reasonMatch = raw.match(/\[.*?-\s*(.*?)\]/);
                          const dispoReason = reasonMatch?.[1] || "";

                          if (!dispoReason) return null;

                          return (
                            <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 hidden w-72 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl group-hover:block">
                              <div className="mb-1 font-semibold text-slate-500">
                                Disposition Reason
                              </div>
                              {dispoReason}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    {c.note ? (
                      <div className="group relative inline-block">
                        <span className="cursor-help text-indigo-600 hover:underline">
                          View
                        </span>

                        {(() => {
                          const raw = (c.note || "").trim();

                          const notesOnly = raw
                            .replace(/\[[^\]]+\]/g, "")
                            .trim();

                          return (
                            <div className="absolute left-0 top-full z-50 mt-2 hidden w-96 rounded-lg border border-slate-200 bg-white p-3 shadow-xl group-hover:block">
                              <div className="mb-1 font-semibold text-slate-500">
                                Notes
                              </div>

                              <p className="whitespace-pre-wrap break-words text-xs">
                                {notesOnly || "No notes"}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {fmtTime(n(c.duration_seconds))}
                  </td>
                  <td className="px-3 py-2">
                    {c.recording_url ? (
                      <div className="flex items-center gap-2">
                        <audio
                          controls
                          src={`/api/recordings/${encodeURIComponent(c.recording_url)}`}
                          className="h-8"
                        />
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {calls.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-4 text-center text-slate-400"
                  >
                    No calls.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

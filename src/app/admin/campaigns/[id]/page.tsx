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

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/campaigns/${id}/details`, {
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
  }, [id]);

  if (loading) return <p className="p-6 text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!data) return null;

  const { campaign, gateways, employees, calls, stats } = data;
  const n = (v: any) => Number(v ?? 0);

  return (
    <div className="space-y-6 p-1">
      {/* Back */}
      <button
        onClick={() => router.push("/admin/campaigns")}
        className="text-sm text-indigo-600 hover:underline"
      >
        ← Back to campaigns
      </button>

      {/* Summary */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {campaign.name}
            </h1>
            {campaign.description && (
              <p className="mt-1 text-sm text-slate-500">
                {campaign.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize">
                {campaign.dialer_type} dialer
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 capitalize">
                {campaign.status}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  campaign.recording_enabled
                    ? "bg-red-100 text-red-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {campaign.recording_enabled
                  ? "● Recording ON"
                  : "Recording OFF"}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Created {campaign.created_at}
          </p>
        </div>

        {gateways.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {gateways.map((g: any) => (
              <span
                key={g.id}
                className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700"
              >
                📡 {g.name} ({g.channels}ch)
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total calls", value: n(stats.total_calls) },
          { label: "Connected", value: n(stats.connected) },
          { label: "Success", value: n(stats.success) },
          { label: "Talk time", value: fmtTime(n(stats.talk_seconds)) },
        ].map((t) => (
          <div key={t.label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{t.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{t.value}</p>
          </div>
        ))}
      </div>

      {/* Assigned employees */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Assigned employees ({employees.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Calls</th>
                <th className="px-3 py-2">Connected</th>
                <th className="px-3 py-2">Success</th>
                <th className="px-3 py-2">Talk</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e: any) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">{e.name}</td>
                  <td className="px-3 py-2 capitalize text-slate-500">
                    {e.role}
                  </td>
                  <td className="px-3 py-2">{n(e.calls)}</td>
                  <td className="px-3 py-2">{n(e.connected)}</td>
                  <td className="px-3 py-2">{n(e.success)}</td>
                  <td className="px-3 py-2">{fmtTime(n(e.talk_seconds))}</td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-4 text-center text-slate-400"
                  >
                    No employees assigned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calls */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Calls ({calls.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Agent</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Recording</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c: any) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">
                    <button
                      onClick={() => router.push(`/admin/customers/${encodeURIComponent(c.phone_number)}`)}
                      className="text-indigo-600 hover:underline"
                    >
                      {c.phone_number}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {c.employee_name ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.status] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {fmtTime(n(c.duration_seconds))}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {c.started_at ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {c.recording_url ? (
                      <audio controls src={c.recording_url} className="h-8" />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {calls.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-4 text-center text-slate-400"
                  >
                    No calls yet.
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

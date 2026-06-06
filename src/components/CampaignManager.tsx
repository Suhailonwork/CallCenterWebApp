"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import type { CampaignRow, DialerType } from "@/types";
import { CampaignAssign } from "./CampaignAssign";
import type { GsmGateway } from "./GatewayManager";

const DIALER_OPTIONS: {
  value: DialerType;
  label: string;
  desc: string;
  color: string;
}[] = [
  {
    value: "predictive",
    label: "Predictive",
    desc: "Auto-dials ahead of agent availability",
    color: "bg-blue-100 text-blue-700",
  },
  {
    value: "manual",
    label: "Manual",
    desc: "Agent dials each contact manually",
    color: "bg-slate-100 text-slate-700",
  },
  {
    value: "inbound",
    label: "Inbound",
    desc: "Receives incoming calls",
    color: "bg-green-100 text-green-700",
  },
  {
    value: "ratio",
    label: "Ratio",
    desc: "Dials at a fixed agent:call ratio",
    color: "bg-amber-100 text-amber-700",
  },
];

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-slate-100 text-slate-600",
};

type CampaignWithGateways = CampaignRow & { gateways?: GsmGateway[] };

export function CampaignManager() {
  const [campaigns, setCampaigns] = useState<CampaignWithGateways[]>([]);
  const [allGateways, setAllGateways] = useState<GsmGateway[]>([]);
  const [gwStatus, setGwStatus] = useState<
    Record<number, { reachable: boolean; state: string }>
  >({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [script, setScript] = useState("");
  const [dialerType, setDialerType] = useState<DialerType>("manual");
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [selectedGatewayIds, setSelectedGatewayIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const [assignFor, setAssignFor] = useState<{
    id: number;
    name: string;
  } | null>(null);
  // Edit-gateway modal for an existing campaign
  const [editGwFor, setEditGwFor] = useState<CampaignWithGateways | null>(null);
  const [editGwIds, setEditGwIds] = useState<number[]>([]);
  const router = useRouter();
  async function load() {
    setLoading(true);
    try {
      const [campRes, gwRes, statusRes] = await Promise.all([
        fetch("/api/admin/campaigns"),
        fetch("/api/admin/gateways"),
        fetch("/api/admin/gateways/status"),
      ]);
      const campData = await campRes.json();
      const gwData = await gwRes.json();
      const statusData = await statusRes.json();
      if (campRes.ok) setCampaigns(campData.campaigns);
      else toast.error(campData.error ?? "Failed to load campaigns");
      if (gwRes.ok) setAllGateways(gwData.gateways);
      if (statusRes.ok) setGwStatus(statusData.status ?? {});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleGateway(
    id: number,
    list: number[],
    setList: (v: number[]) => void,
  ) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function create() {
    if (!name.trim()) {
      toast.warning("Campaign name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          script: script || null,
          dialer_type: dialerType,
          gatewayIds: selectedGatewayIds,
          recording_enabled: recordingEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create campaign");
        return;
      }
      toast.success(
        selectedGatewayIds.length > 0
          ? `Campaign created with ${selectedGatewayIds.length} gateway(s)`
          : "Campaign created",
      );
      setName("");
      setDescription("");
      setScript("");
      setDialerType("manual");
      setSelectedGatewayIds([]);
      setRecordingEnabled(false);
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function updateCampaignGateways() {
    if (!editGwFor) return;
    const res = await fetch(`/api/admin/campaigns/${editGwFor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gatewayIds: editGwIds.filter((id) => Number.isInteger(id) && id > 0),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success("Gateways updated");
      setEditGwFor(null);
      load();
    } else {
      toast.error(data.error ?? "Update failed");
      console.error("[updateCampaignGateways]", res.status, data);
    }
  }

  async function setStatus(id: number, status: string) {
    const res = await fetch(`/api/admin/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success("Campaign updated");
      load();
    } else {
      toast.error("Update failed");
    }
  }

  async function upload(id: number, file: File) {
    setUploading(id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/campaigns/${id}/contacts`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      toast.success(`Imported ${data.imported} contacts`);
      load();
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Campaigns</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "+ New campaign"}
        </button>
      </div>

      {/* ── Create campaign form ── */}
      {showForm && (
        <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Call script
            </label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {/* ── Dialer type ── */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Dialer type
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DIALER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDialerType(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    dialerType === opt.value
                      ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-semibold">{opt.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500 leading-tight">
                    {opt.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Gateway multi-select ── */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              GSM Gateways
              <span className="ml-1 text-xs text-slate-400">
                (select one or more)
              </span>
            </label>
            {allGateways.length === 0 ? (
              <p className="mt-1 text-xs text-slate-400">
                No gateways configured — add one in the Gateways tab first.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {allGateways.map((gw) => {
                  const checked = selectedGatewayIds.includes(gw.id);
                  return (
                    <label
                      key={gw.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        checked
                          ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                          : "border-slate-200 hover:bg-slate-50"
                      } ${gw.status === "inactive" ? "opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={gw.status === "inactive"}
                        onChange={() =>
                          toggleGateway(
                            gw.id,
                            selectedGatewayIds,
                            setSelectedGatewayIds,
                          )
                        }
                        className="accent-indigo-600"
                      />
                      <span className="flex-1 truncate font-medium">
                        {gw.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {gw.channels}ch
                      </span>
                      {gwStatus[gw.id] ? (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                            gwStatus[gw.id].reachable
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {gwStatus[gw.id].reachable ? "● Online" : "● Offline"}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-400">
                          ● Unknown
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            {selectedGatewayIds.length > 0 && (
              <p className="mt-1 text-xs text-indigo-600 font-medium">
                {selectedGatewayIds.length} gateway(s) selected — total{" "}
                {allGateways
                  .filter((g) => selectedGatewayIds.includes(g.id))
                  .reduce((s, g) => s + g.channels, 0)}{" "}
                channels
              </p>
            )}
          </div>

          {/* ── Recording toggle ── */}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
            <input
              type="checkbox"
              checked={recordingEnabled}
              onChange={(e) => setRecordingEnabled(e.target.checked)}
              className="accent-indigo-600"
            />
            <span className="font-medium text-slate-700">
              Enable call recording
            </span>
            <span className="text-xs text-slate-400">
              — records every call in this campaign
            </span>
          </label>

          <button
            onClick={create}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create campaign"}
          </button>
        </div>
      )}

      {/* ── Campaign list ── */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-slate-400">No campaigns yet.</p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => {
              const total = Number(c.total_contacts);
              const called = Number(c.called_contacts);
              const pct = total > 0 ? Math.round((called / total) * 100) : 0;
              const gws = c.gateways ?? [];
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        onClick={() => router.push(`/admin/campaigns/${c.id}`)}
                        className="font-semibold text-indigo-600 hover:underline text-left"
                      >
                        {c.name}
                      </button>
                      {c.description && (
                        <p className="text-xs text-slate-500">
                          {c.description}
                        </p>
                      )}
                      {/* Dialer type badge */}
                      {c.dialer_type &&
                        (() => {
                          const opt = DIALER_OPTIONS.find(
                            (o) => o.value === c.dialer_type,
                          );
                          return opt ? (
                            <span
                              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${opt.color}`}
                            >
                              {opt.label} dialer
                            </span>
                          ) : null;
                        })()}
                      {/* Gateway chips */}
                      {gws.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {gws.map((gw) => (
                            <span
                              key={gw.id}
                              className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700"
                            >
                              📡 {gw.name} ({gw.channels}ch)
                            </span>
                          ))}
                        </div>
                      )}
                      {gws.length === 0 && (
                        <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                          No gateway assigned
                        </span>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status] ?? ""}`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>
                        {called} / {total} contacts called
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-indigo-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
                      {uploading === c.id ? "Uploading…" : "Upload CSV"}
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        disabled={uploading !== null}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) upload(c.id, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      onClick={() => setAssignFor({ id: c.id, name: c.name })}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                    >
                      Assign agents
                    </button>
                    <button
                      onClick={() => {
                        setEditGwFor(c);
                        setEditGwIds((c.gateways ?? []).map((g) => g.id));
                      }}
                      className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50"
                    >
                      Edit gateways
                    </button>
                    {c.status !== "active" && (
                      <button
                        onClick={() => setStatus(c.id, "active")}
                        className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
                      >
                        Activate
                      </button>
                    )}
                    {c.status === "active" && (
                      <button
                        onClick={() => setStatus(c.id, "paused")}
                        className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                      >
                        Pause
                      </button>
                    )}
                    {c.status !== "completed" && (
                      <button
                        onClick={() => setStatus(c.id, "completed")}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                      >
                        Mark completed
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        CSV format: a header row with a <code>phone</code> column (also accepts{" "}
        <code>name</code>, <code>email</code>, <code>company</code>).
      </p>

      {/* ── Edit gateways modal ── */}
      {editGwFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold">
              Edit gateways — {editGwFor.name}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Select the GSM gateways this campaign should use.
            </p>
            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {allGateways.map((gw) => {
                const checked = editGwIds.includes(gw.id);
                return (
                  <label
                    key={gw.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      checked
                        ? "border-indigo-400 bg-indigo-50"
                        : "border-slate-200 hover:bg-slate-50"
                    } ${gw.status === "inactive" ? "opacity-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={gw.status === "inactive"}
                      onChange={() =>
                        toggleGateway(gw.id, editGwIds, setEditGwIds)
                      }
                      className="accent-indigo-600"
                    />
                    <span className="flex-1 font-medium">{gw.name}</span>
                    <span className="text-xs text-slate-500">
                      {gw.ip} · {gw.channels}ch
                    </span>
                    {gwStatus[gw.id] ? (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                          gwStatus[gw.id].reachable
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {gwStatus[gw.id].reachable ? "● Online" : "● Offline"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-400">
                        ● Unknown
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            {editGwIds.length > 0 && (
              <p className="mt-2 text-xs text-indigo-600 font-medium">
                {editGwIds.length} gateway(s) ·{" "}
                {allGateways
                  .filter((g) => editGwIds.includes(g.id))
                  .reduce((s, g) => s + g.channels, 0)}{" "}
                total channels
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={updateCampaignGateways}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Save
              </button>
              <button
                onClick={() => setEditGwFor(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {assignFor && (
        <CampaignAssign
          campaignId={assignFor.id}
          campaignName={assignFor.name}
          onClose={() => setAssignFor(null)}
        />
      )}
    </div>
  );
}

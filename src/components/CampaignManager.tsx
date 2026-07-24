"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import type {
  CampaignRow,
  DialerType,
  DataTable,
  DupMode,
  ListRow,
  RecycleRule,
} from "@/types";
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

// Lead statuses = 'NEW' (never called) + the app's call dispositions.
// Used for the dial_statuses multi-select and the recycle-rules editor.
const LEAD_STATUSES: { value: string; label: string; terminal?: boolean }[] = [
  { value: "NEW", label: "NEW (never called)" },
  { value: "no_answer", label: "No Answer (NA)" },
  { value: "busy", label: "Busy (B)" },
  { value: "failed", label: "Failed / Drop" },
  { value: "voicemail", label: "Voicemail" },
  { value: "wrong_number", label: "Wrong Number", terminal: true },
  { value: "connected", label: "Connected (SALE-like)", terminal: true },
];

const DEFAULT_DIAL_STATUSES = ["NEW", "no_answer", "busy"];

function parseJsonField<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

type CampaignWithGateways = CampaignRow & { gateways?: GsmGateway[] };

interface GroupOption {
  id: number;
  name: string;
}

/**
 * Campaign console, shared by Admin and TL.
 *   - Admin (default): apiBase="/api/admin", consoleBase="/admin", group optional.
 *   - TL: apiBase="/api/tl", consoleBase="/tl" — the TL API only returns/accepts
 *     campaigns in the TL's groups, and a group is required when creating.
 * Gateways are always read from the admin endpoints (TLs have read access).
 */
export function CampaignManager({
  apiBase = "/api/admin",
  consoleBase = "/admin",
  requireGroup = false,
}: {
  apiBase?: string;
  consoleBase?: string;
  requireGroup?: boolean;
} = {}) {
  const [campaigns, setCampaigns] = useState<CampaignWithGateways[]>([]);
  const [allGateways, setAllGateways] = useState<GsmGateway[]>([]);
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);
  const [groupId, setGroupId] = useState<number | "">("");
  const [dataTables, setDataTables] = useState<DataTable[]>([]);
  const [dataTableId, setDataTableId] = useState<number | "">("");
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
  // Upload-CSV modal: a CSV always lands in a LIST of the campaign.
  const [uploadFor, setUploadFor] = useState<CampaignWithGateways | null>(null);
  const [uploadLists, setUploadLists] = useState<ListRow[]>([]);
  const [uploadListId, setUploadListId] = useState<number | "new">("new");
  const [newListName, setNewListName] = useState("");
  const [newListTemplateId, setNewListTemplateId] = useState<number | "">("");
  const [dupMode, setDupMode] = useState<DupMode>("none");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  // Edit-gateway modal for an existing campaign
  const [editGwFor, setEditGwFor] = useState<CampaignWithGateways | null>(null);
  const [editGwIds, setEditGwIds] = useState<number[]>([]);
  // Dial-rules modal (dial_statuses multi-select + recycle rules editor)
  const [rulesFor, setRulesFor] = useState<CampaignWithGateways | null>(null);
  const [selStatuses, setSelStatuses] = useState<string[]>(DEFAULT_DIAL_STATUSES);
  const [recycleRules, setRecycleRules] = useState<RecycleRule[]>([]);
  const [rulesBusy, setRulesBusy] = useState(false);
  const router = useRouter();
  async function load() {
    setLoading(true);
    try {
      const [campRes, gwRes, statusRes, grpRes, dtRes] = await Promise.all([
        fetch(`${apiBase}/campaigns`),
        fetch("/api/admin/gateways"),
        fetch("/api/admin/gateways/status"),
        fetch(`${apiBase}/groups`),
        fetch("/api/admin/data-tables"),
      ]);
      const campData = await campRes.json();
      const gwData = await gwRes.json();
      const statusData = await statusRes.json();
      const grpData = await grpRes.json().catch(() => ({}));
      const dtData = await dtRes.json().catch(() => ({}));
      if (campRes.ok) setCampaigns(campData.campaigns);
      else toast.error(campData.error ?? "Failed to load campaigns");
      if (gwRes.ok) setAllGateways(gwData.gateways);
      if (statusRes.ok) setGwStatus(statusData.status ?? {});
      if (grpRes.ok) setGroupOptions(grpData.groups ?? []);
      if (dtRes.ok) setDataTables(dtData.dataTables ?? []);
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
    if (requireGroup && groupId === "") {
      toast.warning("Select the group this campaign belongs to");
      return;
    }
    if (selectedGatewayIds.length === 0) {
      toast.warning("Select at least one GSM gateway for this campaign");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          script: script || null,
          dialer_type: dialerType,
          gatewayIds: selectedGatewayIds,
          recording_enabled: recordingEnabled,
          group_id: groupId === "" ? null : groupId,
          data_table_id: dataTableId === "" ? null : dataTableId,
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
      setGroupId("");
      setDataTableId("");
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function updateCampaignGateways() {
    if (!editGwFor) return;
    const cleanIds = editGwIds.filter((id) => Number.isInteger(id) && id > 0);
    if (cleanIds.length === 0) {
      toast.warning("A campaign must keep at least one GSM gateway");
      return;
    }
    const res = await fetch(`${apiBase}/campaigns/${editGwFor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gatewayIds: cleanIds }),
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

  function openRules(c: CampaignWithGateways) {
    setRulesFor(c);
    setSelStatuses(parseJsonField<string[]>(c.dial_statuses, DEFAULT_DIAL_STATUSES));
    setRecycleRules(parseJsonField<RecycleRule[]>(c.recycle_rules, []));
  }

  async function saveRules() {
    if (!rulesFor) return;
    for (const r of recycleRules) {
      if (!r.status || r.delay_min < 1 || r.max_attempts < 1) {
        toast.warning("Every recycle rule needs a status, delay ≥ 1 min and attempts ≥ 1");
        return;
      }
    }
    setRulesBusy(true);
    try {
      const res = await fetch(`${apiBase}/campaigns/${rulesFor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dial_statuses: selStatuses,
          recycle_rules: recycleRules,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.error ?? "Update failed");
      toast.success("Dial rules updated");
      setRulesFor(null);
      load();
    } finally {
      setRulesBusy(false);
    }
  }

  async function setStatus(id: number, status: string) {
    const res = await fetch(`${apiBase}/campaigns/${id}`, {
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

  async function openUpload(c: CampaignWithGateways) {
    setUploadFor(c);
    setUploadFile(null);
    setDupMode("none");
    setNewListName("");
    setNewListTemplateId("");
    setUploadLists([]);
    setUploadListId("new");
    const res = await fetch(`${apiBase}/lists?campaignId=${c.id}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const lists: ListRow[] = data.lists ?? [];
      setUploadLists(lists);
      if (lists.length > 0) setUploadListId(lists[0].id);
    }
  }

  async function submitUpload() {
    if (!uploadFor || !uploadFile) {
      toast.warning("Choose a CSV file first");
      return;
    }
    if (uploadListId === "new" && !newListName.trim()) {
      toast.warning("Name the new list");
      return;
    }
    setUploadBusy(true);
    try {
      let listId = uploadListId;
      if (listId === "new") {
        const res = await fetch(`${apiBase}/lists`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newListName.trim(),
            campaign_id: uploadFor.id,
            template_id: newListTemplateId === "" ? null : newListTemplateId,
            active: "Y",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error ?? "Failed to create list");
          return;
        }
        listId = data.id;
      }
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("dupMode", dupMode);
      const res = await fetch(`${apiBase}/lists/${listId}/contacts`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      toast.success(
        `Imported ${data.imported} leads` +
          (data.skippedDuplicates > 0
            ? ` (${data.skippedDuplicates} duplicates skipped)`
            : ""),
      );
      setUploadFor(null);
      load();
    } finally {
      setUploadBusy(false);
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

          {/* ── Group ownership ── */}
          {(groupOptions.length > 0 || requireGroup) && (
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Group
                {!requireGroup && (
                  <span className="ml-1 text-xs text-slate-400">(optional)</span>
                )}
              </label>
              <select
                value={groupId}
                onChange={(e) =>
                  setGroupId(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">
                  {requireGroup ? "Select a group…" : "No group (admin only)"}
                </option>
                {groupOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              {requireGroup && groupOptions.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  You are not assigned to any group yet — ask an admin.
                </p>
              )}
            </div>
          )}

          {/* ── Data table ── */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Data Table
              <span className="ml-1 text-xs text-slate-400">(optional)</span>
            </label>
            <select
              value={dataTableId}
              onChange={(e) =>
                setDataTableId(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">No data table (store all CSV columns)</option>
              {dataTables.map((dt) => (
                <option key={dt.id} value={dt.id}>
                  {dt.name} ({dt.columns?.length ?? 0} cols)
                </option>
              ))}
            </select>
            {dataTableId !== "" &&
              (() => {
                const dt = dataTables.find((d) => d.id === dataTableId);
                return dt ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Stores only: {dt.columns.join(", ")}
                  </p>
                ) : null;
              })()}
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
                        onClick={() => router.push(`${consoleBase}/campaigns/${c.id}`)}
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
                      {/* Group badge */}
                      {c.group_name && (
                        <span className="mt-1 ml-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          👥 {c.group_name}
                        </span>
                      )}
                      {/* Gateway chips — name · endpoint · live status (from DB/ARI) */}
                      {gws.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {gws.map((gw) => {
                            const online = gwStatus[gw.id]?.reachable;
                            const statusLabel =
                              gw.status === "inactive"
                                ? "● disabled"
                                : online
                                  ? "● online"
                                  : online === false
                                    ? "● offline"
                                    : "● unknown";
                            const statusColor =
                              gw.status === "inactive"
                                ? "text-slate-400"
                                : online
                                  ? "text-green-600"
                                  : online === false
                                    ? "text-red-600"
                                    : "text-slate-400";
                            return (
                              <span
                                key={gw.id}
                                className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700"
                              >
                                📡 {gw.name} ·{" "}
                                <span className="font-mono">gw{gw.id}</span> ·{" "}
                                {gw.channels}ch
                                <span className={statusColor}>{statusLabel}</span>
                              </span>
                            );
                          })}
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
                    <button
                      onClick={() => openUpload(c)}
                      className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                    >
                      Upload CSV
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
                    <button
                      onClick={() => openRules(c)}
                      className="rounded-lg border border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50"
                    >
                      Dial rules
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
        CSV format: a header row with a phone column (<code>phone</code>,{" "}
        <code>Mobile NO</code>, <code>phone_number</code>, …). Every upload
        lands in a List of the campaign; the list&apos;s Data Template decides
        which columns are stored.
      </p>

      {/* ── Upload CSV modal (upload targets a LIST) ── */}
      {uploadFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold">
              Upload CSV — {uploadFor.name}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Leads always belong to a list. Pick one of this campaign&apos;s
              lists or create a new one.
            </p>

            <label className="mt-3 block text-sm font-medium text-slate-700">
              Target list
            </label>
            <select
              value={uploadListId}
              onChange={(e) =>
                setUploadListId(
                  e.target.value === "new" ? "new" : Number(e.target.value),
                )
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {uploadLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.lead_count} leads ·{" "}
                  {l.active === "Y" ? "ON" : "OFF"}
                  {l.template_name ? ` · ${l.template_name}` : ""}
                </option>
              ))}
              <option value="new">➕ Create a new list…</option>
            </select>

            {uploadListId === "new" && (
              <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    New list name
                  </label>
                  <input
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="e.g. July BX batch"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Data Template
                  </label>
                  <select
                    value={newListTemplateId}
                    onChange={(e) =>
                      setNewListTemplateId(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">No template (store all CSV columns)</option>
                    {dataTables.map((dt) => (
                      <option key={dt.id} value={dt.id}>
                        {dt.name} ({dt.columns?.length ?? 0} cols)
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-400">
                  The new list starts ON (dialable) in this campaign.
                </p>
              </div>
            )}

            <label className="mt-3 block text-sm font-medium text-slate-700">
              Duplicate check
            </label>
            <select
              value={dupMode}
              onChange={(e) => setDupMode(e.target.value as DupMode)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="none">No duplicate check (append everything)</option>
              <option value="list">Skip phones already in this list</option>
              <option value="campaign">
                Skip phones in any list of this campaign
              </option>
            </select>

            <label className="mt-3 block text-sm font-medium text-slate-700">
              CSV file
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm"
            />

            <div className="mt-4 flex gap-2">
              <button
                onClick={submitUpload}
                disabled={uploadBusy}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {uploadBusy ? "Uploading…" : "Upload"}
              </button>
              <button
                onClick={() => setUploadFor(null)}
                disabled={uploadBusy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dial rules modal (dial statuses + lead recycle) ── */}
      {rulesFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold">Dial rules — {rulesFor.name}</h2>

            <p className="mt-1 text-xs text-slate-500">
              The dialer only claims leads whose status is checked below
              (from lists that are switched ON).
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {LEAD_STATUSES.map((s) => {
                const checked = selStatuses.includes(s.value);
                return (
                  <label
                    key={s.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                      checked
                        ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelStatuses((prev) =>
                          prev.includes(s.value)
                            ? prev.filter((x) => x !== s.value)
                            : [...prev, s.value],
                        )
                      }
                      className="accent-indigo-600"
                    />
                    <span className="font-medium">{s.label}</span>
                  </label>
                );
              })}
            </div>
            {selStatuses.some(
              (v) => LEAD_STATUSES.find((s) => s.value === v)?.terminal,
            ) && (
              <p className="mt-1 text-xs text-amber-600">
                ⚠ Connected / Wrong Number are usually final — including them
                re-dials closed leads after a reset.
              </p>
            )}
            {selStatuses.length === 0 && (
              <p className="mt-1 text-xs text-red-600">
                No statuses selected — this campaign will only dial recycled
                leads (below), nothing fresh.
              </p>
            )}

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  Lead recycle (auto-retry)
                </p>
                <button
                  onClick={() =>
                    setRecycleRules((r) => [
                      ...r,
                      { status: "no_answer", delay_min: 60, max_attempts: 3 },
                    ])
                  }
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50"
                >
                  + Add rule
                </button>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Re-dial leads with a status after a delay, up to N extra
                attempts — even before a list reset.
              </p>
              {recycleRules.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">
                  No recycle rules — leads are only re-dialed after a list RESET.
                </p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {recycleRules.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <select
                        value={r.status}
                        onChange={(e) =>
                          setRecycleRules((rules) =>
                            rules.map((x, j) =>
                              j === i ? { ...x, status: e.target.value } : x,
                            ),
                          )
                        }
                        className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5"
                      >
                        {LEAD_STATUSES.filter((s) => s.value !== "NEW").map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1">
                        after
                        <input
                          type="number"
                          min={1}
                          value={r.delay_min}
                          onChange={(e) =>
                            setRecycleRules((rules) =>
                              rules.map((x, j) =>
                                j === i
                                  ? { ...x, delay_min: Number(e.target.value) }
                                  : x,
                              ),
                            )
                          }
                          className="w-16 rounded-lg border border-slate-300 px-2 py-1.5"
                        />
                        min
                      </label>
                      <label className="flex items-center gap-1">
                        max
                        <input
                          type="number"
                          min={1}
                          value={r.max_attempts}
                          onChange={(e) =>
                            setRecycleRules((rules) =>
                              rules.map((x, j) =>
                                j === i
                                  ? { ...x, max_attempts: Number(e.target.value) }
                                  : x,
                              ),
                            )
                          }
                          className="w-14 rounded-lg border border-slate-300 px-2 py-1.5"
                        />
                        tries
                      </label>
                      <button
                        onClick={() =>
                          setRecycleRules((rules) => rules.filter((_, j) => j !== i))
                        }
                        className="rounded-lg border border-red-200 px-2 py-1.5 font-medium text-red-600 hover:bg-red-50"
                        title="Remove rule"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={saveRules}
                disabled={rulesBusy}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {rulesBusy ? "Saving…" : "Save dial rules"}
              </button>
              <button
                onClick={() => setRulesFor(null)}
                disabled={rulesBusy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

    </div>
  );
}

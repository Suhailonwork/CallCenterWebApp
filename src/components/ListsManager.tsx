"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import type { CampaignRow, DataTable, ListRow } from "@/types";

/**
 * Admin Lists console — VICIdial-style: a campaign is only rules; leads live
 * in lists. Each list can be switched ON/OFF for dialing, reset (make every
 * lead fresh again without touching statuses), re-homed to another campaign,
 * renamed, or deleted (only when empty).
 */
export function ListsManager() {
  const [lists, setLists] = useState<ListRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [dataTables, setDataTables] = useState<DataTable[]>([]);
  const [campaignFilter, setCampaignFilter] = useState<number | "">("");
  const [loading, setLoading] = useState(true);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [campaignId, setCampaignId] = useState<number | "">("");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [active, setActive] = useState<"Y" | "N">("Y");
  const [saving, setSaving] = useState(false);

  // Modify modal
  const [editFor, setEditFor] = useState<ListRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCampaignId, setEditCampaignId] = useState<number | "">("");
  const [editTemplateId, setEditTemplateId] = useState<number | "">("");

  // Reset confirm modal
  const [resetFor, setResetFor] = useState<ListRow | null>(null);
  const [resetPreview, setResetPreview] = useState<{
    totalLeads: number;
    resetCount: number;
    dialableAfter: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [listRes, campRes, dtRes] = await Promise.all([
        fetch("/api/admin/lists"),
        fetch("/api/admin/campaigns"),
        fetch("/api/admin/data-tables"),
      ]);
      const listData = await listRes.json().catch(() => ({}));
      const campData = await campRes.json().catch(() => ({}));
      const dtData = await dtRes.json().catch(() => ({}));
      if (listRes.ok) setLists(listData.lists ?? []);
      else toast.error(listData.error ?? "Failed to load lists");
      if (campRes.ok) setCampaigns(campData.campaigns ?? []);
      if (dtRes.ok) setDataTables(dtData.dataTables ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(
    () =>
      campaignFilter === ""
        ? lists
        : lists.filter((l) => l.campaign_id === campaignFilter),
    [lists, campaignFilter],
  );

  async function create() {
    if (!name.trim()) return void toast.warning("List name is required");
    if (campaignId === "") return void toast.warning("Pick the campaign this list belongs to");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description || null,
          campaign_id: campaignId,
          template_id: templateId === "" ? null : templateId,
          active,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.error ?? "Failed to create list");
      toast.success("List created");
      setName("");
      setDescription("");
      setCampaignId("");
      setTemplateId("");
      setActive("Y");
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(l: ListRow) {
    const next = l.active === "Y" ? "N" : "Y";
    const res = await fetch(`/api/admin/lists/${l.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success(
        next === "Y"
          ? `"${l.name}" is ON — its leads are dialable`
          : `"${l.name}" is OFF — no new calls from this list`,
      );
      load();
    } else toast.error(data.error ?? "Update failed");
  }

  function openEdit(l: ListRow) {
    setEditFor(l);
    setEditName(l.name);
    setEditDescription(l.description ?? "");
    setEditCampaignId(l.campaign_id);
    setEditTemplateId(l.template_id ?? "");
  }

  async function saveEdit() {
    if (!editFor) return;
    if (!editName.trim()) return void toast.warning("List name is required");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/lists/${editFor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription || null,
          campaign_id: editCampaignId === "" ? undefined : editCampaignId,
          template_id: editTemplateId === "" ? null : editTemplateId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.error ?? "Update failed");
      toast.success("List updated");
      setEditFor(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function openReset(l: ListRow) {
    setResetFor(l);
    setResetPreview(null);
    const res = await fetch(`/api/admin/lists/${l.id}/reset`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setResetPreview(data);
    else toast.error(data.error ?? "Failed to load reset preview");
  }

  async function doReset() {
    if (!resetFor) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/lists/${resetFor.id}/reset`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.error ?? "Reset failed");
      toast.success(
        `"${resetFor.name}" reset — ${data.dialableAfter} leads are dialable again`,
      );
      setResetFor(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(l: ListRow) {
    if (l.lead_count > 0) {
      toast.warning("Only empty lists can be deleted");
      return;
    }
    if (!window.confirm(`Delete list "${l.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/lists/${l.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success("List deleted");
      load();
    } else toast.error(data.error ?? "Delete failed");
  }

  function fmtDate(s: string | null | undefined) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Lists</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "+ New list"}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Campaigns hold the rules; lists hold the leads. Only lists switched ON
        are dialed. RESET makes every lead in a list fresh again without
        touching its status.
      </p>

      {/* ── Create list form ── */}
      {showForm && (
        <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Campaign</label>
              <select
                value={campaignId}
                onChange={(e) =>
                  setCampaignId(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select a campaign…</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Data Template
                <span className="ml-1 text-xs text-slate-400">(optional)</span>
              </label>
              <select
                value={templateId}
                onChange={(e) =>
                  setTemplateId(e.target.value === "" ? "" : Number(e.target.value))
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
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active === "Y"}
              onChange={(e) => setActive(e.target.checked ? "Y" : "N")}
              className="accent-indigo-600"
            />
            <span className="font-medium text-slate-700">Active (dialable) immediately</span>
          </label>
          <button
            onClick={create}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create list"}
          </button>
        </div>
      )}

      {/* ── Campaign filter ── */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600">Campaign:</label>
        <select
          value={campaignFilter}
          onChange={(e) =>
            setCampaignFilter(e.target.value === "" ? "" : Number(e.target.value))
          }
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── Lists table ── */}
      <div className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-slate-400">
            No lists yet — upload a CSV from the Campaigns page or create one here.
          </p>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Campaign</th>
                <th className="py-2 pr-3">Template</th>
                <th className="py-2 pr-3">Dialing</th>
                <th className="py-2 pr-3">Leads</th>
                <th className="py-2 pr-3">Statuses</th>
                <th className="py-2 pr-3">Last call</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 text-slate-400">{l.id}</td>
                  <td className="py-2 pr-3">
                    <p className="font-medium">{l.name}</p>
                    {l.description && (
                      <p className="text-xs text-slate-400">{l.description}</p>
                    )}
                  </td>
                  <td className="py-2 pr-3">{l.campaign_name}</td>
                  <td className="py-2 pr-3 text-xs text-slate-500">
                    {l.template_name ?? "—"}
                  </td>
                  <td className="py-2 pr-3">
                    <button
                      onClick={() => toggleActive(l)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        l.active === "Y"
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                      title="Toggle whether the dialer may claim leads from this list"
                    >
                      {l.active === "Y" ? "● ON" : "○ OFF"}
                    </button>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="font-medium">{l.lead_count}</span>
                    <span className="ml-1 text-xs text-slate-400">
                      ({l.fresh_count} fresh)
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex max-w-[220px] flex-wrap gap-1">
                      {Object.entries(l.status_counts ?? {}).map(([s, n]) => (
                        <span
                          key={s}
                          className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600"
                        >
                          {s}: {n}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-500">
                    {fmtDate(l.last_call_at)}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => openEdit(l)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50"
                      >
                        Modify
                      </button>
                      <button
                        onClick={() => openReset(l)}
                        className="rounded-lg border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                      >
                        Reset
                      </button>
                      <button
                        onClick={() => remove(l)}
                        disabled={l.lead_count > 0}
                        title={
                          l.lead_count > 0
                            ? "Only empty lists can be deleted"
                            : "Delete this empty list"
                        }
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modify modal ── */}
      {editFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold">Modify list — {editFor.name}</h2>
            <label className="mt-3 block text-sm font-medium text-slate-700">Name</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Description
            </label>
            <input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <label className="mt-3 block text-sm font-medium text-slate-700">Campaign</label>
            <select
              value={editCampaignId}
              onChange={(e) =>
                setEditCampaignId(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {editCampaignId !== "" && editCampaignId !== editFor.campaign_id && (
              <p className="mt-1 text-xs text-amber-600">
                Moving this list re-homes all {editFor.lead_count} of its leads to
                the selected campaign.
              </p>
            )}
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Data Template
            </label>
            <select
              value={editTemplateId}
              onChange={(e) =>
                setEditTemplateId(e.target.value === "" ? "" : Number(e.target.value))
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
            <p className="mt-1 text-[11px] text-slate-400">
              The template applies to FUTURE uploads into this list; existing
              leads keep their stored fields.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={saveEdit}
                disabled={busy}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditFor(null)}
                disabled={busy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset confirm modal ── */}
      {resetFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold">Reset list — {resetFor.name}</h2>
            <p className="mt-2 text-sm text-slate-600">
              RESET marks every lead as not-called-since-reset. Statuses are NOT
              changed — only leads whose status is in the campaign&apos;s dialable
              statuses become claimable again.
            </p>
            {resetPreview ? (
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                <p>
                  Total leads: <b>{resetPreview.totalLeads}</b>
                </p>
                <p>
                  Called flags cleared: <b>{resetPreview.resetCount}</b>
                </p>
                <p className="text-green-700">
                  Dialable after reset: <b>{resetPreview.dialableAfter}</b>
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Calculating…</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={doReset}
                disabled={busy || !resetPreview}
                className="flex-1 rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {busy ? "Resetting…" : "Reset list"}
              </button>
              <button
                onClick={() => setResetFor(null)}
                disabled={busy}
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

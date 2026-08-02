"use client";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import type { GroupRow, GroupMember } from "@/types";

/**
 * Admin Groups console — create / edit / delete groups and assign
 * Team Leads + agents. Campaign ownership is set from the Campaigns tab.
 */
export function GroupManager() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [allTls, setAllTls] = useState<GroupMember[]>([]);
  const [allAgents, setAllAgents] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tlIds, setTlIds] = useState<number[]>([]);
  const [agentIds, setAgentIds] = useState<number[]>([]);

  // Edit modal
  const [editFor, setEditFor] = useState<GroupRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTlIds, setEditTlIds] = useState<number[]>([]);
  const [editAgentIds, setEditAgentIds] = useState<number[]>([]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/groups");
      const data = await res.json();
      if (res.ok) {
        setGroups(data.groups);
        setAllTls(data.tls);
        setAllAgents(data.agents);
      } else {
        toast.error(data.error ?? "Failed to load groups");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(id: number, list: number[], setList: (v: number[]) => void) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function create() {
    if (!name.trim()) {
      toast.warning("Group name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          tlIds,
          agentIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create group");
        return;
      }
      toast.success("Group created");
      setName("");
      setDescription("");
      setTlIds([]);
      setAgentIds([]);
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  function openEdit(g: GroupRow) {
    setEditFor(g);
    setEditName(g.name);
    setEditDescription(g.description ?? "");
    setEditTlIds(g.tls.map((t) => t.id));
    setEditAgentIds(g.agents.map((a) => a.id));
  }

  async function saveEdit() {
    if (!editFor) return;
    if (!editName.trim()) {
      toast.warning("Group name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/groups/${editFor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription || null,
          tlIds: editTlIds,
          agentIds: editAgentIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to update group");
        return;
      }
      toast.success("Group updated");
      setEditFor(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(g: GroupRow) {
    if (
      !window.confirm(
        `Delete group "${g.name}"? Its campaigns are kept and become ungrouped (admin-only).`,
      )
    )
      return;
    const res = await fetch(`/api/admin/groups/${g.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success("Group deleted");
      load();
    } else {
      toast.error(data.error ?? "Delete failed");
    }
  }

  function memberPicker(
    label: string,
    pool: GroupMember[],
    selected: number[],
    setSelected: (v: number[]) => void,
  ) {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700">
          {label}
        </label>
        {pool.length === 0 ? (
          <p className="mt-1 text-xs text-slate-400">None available.</p>
        ) : (
          <div className="mt-2 grid max-h-48 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
            {pool.map((p) => {
              const checked = selected.includes(p.id);
              return (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                    checked
                      ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.id, selected, setSelected)}
                    className="accent-indigo-600"
                  />
                  <span className="truncate">{p.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Groups</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "+ New group"}
        </button>
      </div>

      {/* ── Create group form ── */}
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
          {memberPicker("Team Leads", allTls, tlIds, setTlIds)}
          {memberPicker("Agents", allAgents, agentIds, setAgentIds)}
          <button
            onClick={create}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create group"}
          </button>
        </div>
      )}

      {/* ── Group list ── */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-slate-400">
            No groups yet. Create one to give Team Leads their own campaigns
            and agents.
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{g.name}</p>
                    {g.description && (
                      <p className="text-xs text-slate-500">{g.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {g.tls.map((t) => (
                        <span
                          key={`tl-${t.id}`}
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                        >
                          TL · {t.name}
                        </span>
                      ))}
                      {g.tls.length === 0 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                          No team lead
                        </span>
                      )}
                      {g.agents.map((a) => (
                        <span
                          key={`ag-${a.id}`}
                          className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700"
                        >
                          {a.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    {g.campaign_count} campaign{Number(g.campaign_count) === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => openEdit(g)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(g)}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Edit modal ── */}
      {editFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold">Edit group — {editFor.name}</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Description
              </label>
              <input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            {memberPicker("Team Leads", allTls, editTlIds, setEditTlIds)}
            {memberPicker("Agents", allAgents, editAgentIds, setEditAgentIds)}
            <div className="flex gap-2 pt-1">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditFor(null)}
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

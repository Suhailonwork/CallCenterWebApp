'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Button } from '@/components/Button';
import type { DataTable } from '@/types';

export function DataTableManager() {
  const [dataTables, setDataTables] = useState<DataTable[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [editDt, setEditDt]         = useState<DataTable | null>(null);

  // form state
  const [name,    setName]    = useState('');
  const [columns, setColumns] = useState<string[]>(['']);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/data-tables', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setDataTables(data.dataTables);
      else toast.error(data.error ?? 'Failed to load data tables');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditDt(null);
    setName('');
    setColumns(['']);
    setShowForm(true);
  }

  function openEdit(dt: DataTable) {
    setEditDt(dt);
    setName(dt.name);
    setColumns(dt.columns.length > 0 ? [...dt.columns] : ['']);
    setShowForm(true);
  }

  function setColumn(i: number, value: string) {
    setColumns((cols) => cols.map((c, idx) => (idx === i ? value : c)));
  }

  function addColumn() {
    setColumns((cols) => [...cols, '']);
  }

  function removeColumn(i: number) {
    setColumns((cols) => (cols.length > 1 ? cols.filter((_, idx) => idx !== i) : cols));
  }

  async function save() {
    const cleaned = columns.map((c) => c.trim()).filter((c) => c !== '');
    if (!name.trim()) {
      toast.warning('Name is required');
      return;
    }
    if (cleaned.length === 0) {
      toast.warning('Add at least one column');
      return;
    }
    setSaving(true);
    try {
      const body = { name: name.trim(), columns: cleaned };
      const res  = editDt
        ? await fetch(`/api/admin/data-tables/${editDt.id}`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
          })
        : await fetch('/api/admin/data-tables', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Save failed'); return; }
      toast.success(editDt ? 'Data table updated' : 'Data table created');
      setShowForm(false);
      load();
    } catch { toast.error('Network error'); }
    finally   { setSaving(false); }
  }

  async function remove(dt: DataTable) {
    if (!confirm(`Delete data table "${dt.name}"? Campaigns using it will fall back to storing all CSV columns.`)) return;
    const res = await fetch(`/api/admin/data-tables/${dt.id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Data table deleted'); load(); }
    else        { toast.error('Delete failed'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Data Tables</h1>
        <button
          onClick={openCreate}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          + New data table
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total data tables', value: dataTables.length },
          { label: 'Total columns',     value: dataTables.reduce((s, d) => s + (d.columns?.length ?? 0), 0) },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : dataTables.length === 0 ? (
          <p className="text-sm text-slate-400">No data tables configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-400">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Columns</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dataTables.map((dt) => (
                  <tr key={dt.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 font-medium align-top">{dt.name}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {(dt.columns ?? []).map((col, i) => (
                          <span
                            key={`${col}-${i}`}
                            className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                          >
                            {i + 1}. {col}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 text-right space-x-1 align-top">
                      <button
                        onClick={() => openEdit(dt)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(dt)}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs text-indigo-800">
        <p className="font-semibold">ℹ️ How data tables work</p>
        <p className="mt-1">
          A data table is a reusable, ordered set of column names. Pick one when creating a campaign.
          When a CSV is uploaded to that campaign, only these columns (matched to the CSV headers,
          case-insensitively) are stored — in this exact order — and the agent sees them in the
          customer details card. No extra database tables are created.
        </p>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold">
              {editDt ? 'Edit data table' : 'New Data Table'}
            </h2>

            <label className="mt-4 block text-sm font-medium text-slate-700">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Loan Table"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />

            <label className="mt-4 block text-sm font-medium text-slate-700">Columns (in order)</label>
            <div className="mt-2 space-y-2 max-h-72 overflow-y-auto">
              {columns.map((col, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-right text-xs text-slate-400">{i + 1}.</span>
                  <input
                    value={col}
                    onChange={(e) => setColumn(i, e.target.value)}
                    placeholder="e.g. Proposal No"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeColumn(i)}
                    disabled={columns.length <= 1}
                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addColumn}
              className="mt-2 rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
            >
              + Add column
            </button>

            <div className="mt-5 flex gap-2">
              <Button onClick={save} loading={saving} className="flex-1">
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

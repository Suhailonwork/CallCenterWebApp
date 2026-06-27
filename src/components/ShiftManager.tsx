'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Button } from '@/components/Button';
import type { Shift } from '@/types';

const EMPTY = {
  name: '',
  start_time: '09:00',
  end_time: '18:00',
  grace_minutes: 15,
  working_hours: '' as string,
  is_active: true,
};

/**
 * Admin shift management. Shifts define the punctuality window (start time +
 * grace) that drives the Green / Yellow / Red attendance status. Deleting a
 * shift only deactivates it, so historical attendance keeps its shift name.
 */
export function ShiftManager({ onClose }: { onClose?: () => void }) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<'create' | Shift | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  const editing = modal && modal !== 'create' ? modal : null;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shifts');
      const data = await res.json();
      if (res.ok) setShifts(data.shifts ?? []);
      else toast.error(data.error ?? 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm({ ...EMPTY });
    setModal('create');
  }
  function openEdit(s: Shift) {
    setForm({
      name: s.name,
      start_time: s.start_time,
      end_time: s.end_time,
      grace_minutes: s.grace_minutes,
      working_hours: s.working_hours == null ? '' : String(s.working_hours),
      is_active: !!s.is_active,
    });
    setModal(s);
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error('Shift name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        start_time: form.start_time,
        end_time: form.end_time,
        grace_minutes: Number(form.grace_minutes) || 0,
        working_hours: form.working_hours === '' ? null : Number(form.working_hours),
        is_active: form.is_active,
      };
      const res = editing
        ? await fetch(`/api/admin/shifts/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/admin/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Save failed');
        return;
      }
      toast.success(editing ? 'Shift updated' : 'Shift created');
      setModal(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Shift) {
    const res = s.is_active
      ? await fetch(`/api/admin/shifts/${s.id}`, { method: 'DELETE' })
      : await fetch(`/api/admin/shifts/${s.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true }),
        });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? 'Update failed');
      return;
    }
    toast.success(s.is_active ? 'Shift deactivated' : 'Shift activated');
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Manage shifts</h2>
          <div className="flex gap-2">
            <Button onClick={openCreate}>+ New shift</Button>
            {onClose && (
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : shifts.length === 0 ? (
            <p className="text-sm text-slate-400">No shifts yet. Create one to start tracking punctuality.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-400">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Start</th>
                  <th className="pb-2">End</th>
                  <th className="pb-2 text-right">Grace</th>
                  <th className="pb-2 text-right">Hours</th>
                  <th className="pb-2 text-right">Assigned</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 font-medium">{s.name}</td>
                    <td className="py-2 text-slate-500">{s.start_time}</td>
                    <td className="py-2 text-slate-500">{s.end_time}</td>
                    <td className="py-2 text-right text-slate-500">{s.grace_minutes}m</td>
                    <td className="py-2 text-right text-slate-500">
                      {s.working_hours == null ? '—' : `${s.working_hours}h`}
                    </td>
                    <td className="py-2 text-right text-slate-500">{s.assigned_count ?? 0}</td>
                    <td className="py-2">
                      <span
                        className={
                          'text-xs font-medium ' +
                          (s.is_active ? 'text-green-600' : 'text-red-500')
                        }
                      >
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => openEdit(s)}
                        className="mr-2 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(s)}
                        className={
                          'rounded px-2 py-1 text-xs font-medium ' +
                          (s.is_active
                            ? 'border border-red-300 text-red-600 hover:bg-red-50'
                            : 'border border-green-300 text-green-600 hover:bg-green-50')
                        }
                      >
                        {s.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <h3 className="text-base font-semibold">{editing ? 'Edit shift' : 'New shift'}</h3>

              <label className="mt-4 block text-sm font-medium text-slate-700">Shift name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Morning"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Start time</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">End time</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Grace (minutes)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.grace_minutes}
                    onChange={(e) => setForm((f) => ({ ...f, grace_minutes: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Working hours</label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={form.working_hours}
                    onChange={(e) => setForm((f) => ({ ...f, working_hours: e.target.value }))}
                    placeholder="optional"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                Active
              </label>

              <div className="mt-5 flex gap-2">
                <Button onClick={submit} loading={saving} className="flex-1">
                  Save
                </Button>
                <Button variant="secondary" onClick={() => setModal(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

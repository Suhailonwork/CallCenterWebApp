'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

interface Emp {
  id: number;
  name: string;
}

export function CampaignAssign({
  campaignId,
  campaignName,
  onClose,
}: {
  campaignId: number;
  campaignName: string;
  onClose: () => void;
}) {
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/assignments`);
        const data = await res.json();
        if (res.ok) {
          setEmployees(data.employees);
          setSelected(new Set<number>(data.assigned));
        } else {
          toast.error(data.error ?? 'Failed to load assignments');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId]);

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/assignments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Save failed');
        return;
      }
      toast.success('Campaign assignment saved');
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-base font-semibold">Assign agents</h2>
        <p className="mt-0.5 text-sm text-slate-500">{campaignName}</p>

        <div className="mt-4 max-h-72 space-y-1 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : employees.length === 0 ? (
            <p className="text-sm text-slate-400">No agents available to assign.</p>
          ) : (
            employees.map((e) => (
              <label
                key={e.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => toggle(e.id)}
                />
                {e.name}
              </label>
            ))
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={save}
            disabled={saving || loading}
            className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save assignment'}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

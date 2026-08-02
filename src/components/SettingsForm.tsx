'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

const FIELDS: { key: string; label: string; type: string }[] = [
  { key: 'break_minutes_per_day', label: 'Break minutes allowed per day', type: 'number' },
  { key: 'max_breaks_per_day', label: 'Maximum breaks per day', type: 'number' },
  { key: 'call_limit_per_day', label: 'Call limit per employee per day', type: 'number' },
  { key: 'work_start', label: 'Working hours — start', type: 'time' },
  { key: 'work_end', label: 'Working hours — end', type: 'time' },
  { key: 'min_password_length', label: 'Minimum password length', type: 'number' },
  {
    key: 'recording_retention_days',
    label: 'Call recording retention (days)',
    type: 'number',
  },
  // ── Predictive dialer ──
  { key: 'predictive_ratio', label: 'Predictive ratio (calls per available agent)', type: 'number' },
  { key: 'phone_cooldown_seconds', label: 'Phone cooldown (seconds before re-dialing a number)', type: 'number' },
  { key: 'dialer_claim_timeout_sec', label: 'Contact claim timeout (seconds)', type: 'number' },
  { key: 'dialer_oncall_timeout_sec', label: 'Stuck on-call recovery timeout (seconds)', type: 'number' },
];

export function SettingsForm() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/settings');
        const data = await res.json();
        if (res.ok) setValues(data.settings ?? {});
        else toast.error(data.error ?? 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Save failed');
        return;
      }
      toast.success('Settings saved');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-lg font-semibold">System Settings</h1>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="space-y-3">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-slate-700">
                  {f.label}
                </label>
                <input
                  type={f.type}
                  value={values[f.key] ?? ''}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            ))}
            <button
              onClick={save}
              disabled={saving}
              className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import type { BreakRequest } from '@/types';
import { useSocketEvent } from '@/lib/useSocket';

const TYPES = [
  { value: 'short', label: 'Short break' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'other', label: 'Other' },
];

export function BreakWidget() {
  const [breaks, setBreaks] = useState<BreakRequest[]>([]);
  const [breakType, setBreakType] = useState('short');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/employee/breaks');
      const data = await res.json();
      if (res.ok) setBreaks(data.breaks);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    load();
  }, []);

  useSocketEvent('data-changed', (p: { scope?: string }) => {
    if (p?.scope === 'breaks') load();
  });

  const current = breaks.find(
    (b) => b.status === 'requested' || b.status === 'active',
  );
  const history = breaks
    .filter((b) => b.status === 'completed' || b.status === 'denied')
    .slice(0, 4);

  async function request() {
    setBusy(true);
    try {
      const res = await fetch('/api/employee/breaks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ breakType, reason: reason || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to request break');
        return;
      }
      toast.success('Break requested');
      setReason('');
      load();
    } finally {
      setBusy(false);
    }
  }

  async function end() {
    if (!current) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/breaks/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end' }),
      });
      if (res.ok) {
        toast.success('Break ended');
        load();
      } else {
        toast.error('Could not end break');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-500">Break</h2>

      {current?.status === 'requested' && (
        <p className="text-sm text-amber-600">
          Break requested — waiting for approval.
        </p>
      )}

      {current?.status === 'active' && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-green-600">
            You are on a {current.break_type} break.
          </p>
          <button
            onClick={end}
            disabled={busy}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            End break
          </button>
        </div>
      )}

      {!current && (
        <div className="flex flex-wrap items-end gap-2">
          <select
            value={breakType}
            onChange={(e) => setBreakType(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={request}
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Request break
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="mb-1 text-xs font-medium text-slate-400">Recent breaks</p>
          {history.map((b) => (
            <div key={b.id} className="flex justify-between text-xs text-slate-500">
              <span className="capitalize">{b.break_type}</span>
              <span
                className={
                  b.status === 'denied' ? 'text-red-500' : 'text-slate-400'
                }
              >
                {b.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { format, parseISO } from 'date-fns';
import type { BreakRequest } from '@/types';
import { useSocketEvent } from '@/lib/useSocket';

function when(value: string | null) {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'MMM d, HH:mm');
  } catch {
    return value;
  }
}

export function BreakApprovals() {
  const [breaks, setBreaks] = useState<BreakRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/breaks');
      const data = await res.json();
      if (res.ok) setBreaks(data.breaks);
      else toast.error(data.error ?? 'Failed to load breaks');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  useSocketEvent('data-changed', (p: { scope?: string }) => {
    if (p?.scope === 'breaks') load();
  });

  async function act(id: number, action: 'approve' | 'deny' | 'end') {
    const res = await fetch(`/api/breaks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? 'Action failed');
      return;
    }
    toast.success(
      action === 'approve'
        ? 'Break approved'
        : action === 'deny'
          ? 'Break denied'
          : 'Break ended',
    );
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Break Requests</h1>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : breaks.length === 0 ? (
          <p className="text-sm text-slate-400">
            No pending or active breaks right now.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-400">
                <th className="pb-2">Employee</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Reason</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Requested</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {breaks.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 font-medium">{b.employee_name}</td>
                  <td className="py-2 capitalize">{b.break_type}</td>
                  <td className="py-2 text-slate-500">{b.reason ?? '—'}</td>
                  <td className="py-2">
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-xs font-medium ' +
                        (b.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700')
                      }
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="py-2 text-slate-500">{when(b.created_at)}</td>
                  <td className="py-2 text-right">
                    {b.status === 'requested' ? (
                      <>
                        <button
                          onClick={() => act(b.id, 'approve')}
                          className="mr-2 rounded border border-green-300 px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => act(b.id, 'deny')}
                          className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Deny
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => act(b.id, 'end')}
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50"
                      >
                        End break
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

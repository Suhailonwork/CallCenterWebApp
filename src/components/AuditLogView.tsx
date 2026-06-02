'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { AuditRow } from '@/types';

function when(v: string) {
  try {
    return format(parseISO(v), 'MMM d, yyyy HH:mm');
  } catch {
    return v;
  }
}

export function AuditLogView() {
  const [entries, setEntries] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/audit');
        const data = await res.json();
        if (res.ok) setEntries(data.entries);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Audit Log</h1>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-400">No audit entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-400">
                  <th className="pb-2">When</th>
                  <th className="pb-2">User</th>
                  <th className="pb-2">Action</th>
                  <th className="pb-2">Entity</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 text-slate-500">{when(e.created_at)}</td>
                    <td className="py-2">{e.user_name ?? 'system'}</td>
                    <td className="py-2 font-medium">{e.action.replace(/_/g, ' ')}</td>
                    <td className="py-2 text-slate-500">
                      {e.entity ?? '—'}
                      {e.entity_id ? ` #${e.entity_id}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

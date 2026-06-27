'use client';

import { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/Button';
import type { AuditRow } from '@/types';

function when(v: string) {
  try {
    return format(parseISO(v), 'MMM d, yyyy HH:mm');
  } catch {
    return v;
  }
}

function detailsText(d: unknown): string {
  if (d == null) return '';
  if (typeof d === 'string') return d;
  try {
    return JSON.stringify(d);
  } catch {
    return '';
  }
}

interface AuditResponse {
  entries: AuditRow[];
  actions: string[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function AuditLogView() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  // The text actually applied to the query (separate from the input box).
  const [appliedQ, setAppliedQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (action) params.set('action', action);
      if (appliedQ) params.set('q', appliedQ);
      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      const json = await res.json();
      if (res.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }, [page, action, appliedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  const actions = data?.actions ?? [];
  const entries = data?.entries ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Audit Log</h1>
        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setAppliedQ(q.trim());
            }}
            className="flex items-center gap-2"
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search action / user…"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={action}
              onChange={(e) => {
                setPage(1);
                setAction(e.target.value);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary" loading={loading}>
              Search
            </Button>
          </form>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {loading && !data ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-400">No audit entries match your filters.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-400">
                    <th className="pb-2">When</th>
                    <th className="pb-2">User</th>
                    <th className="pb-2">Action</th>
                    <th className="pb-2">Entity</th>
                    <th className="pb-2">Details</th>
                    <th className="pb-2">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 last:border-0 align-top">
                      <td className="py-2 text-slate-500 whitespace-nowrap">{when(e.created_at)}</td>
                      <td className="py-2">{e.user_name ?? 'system'}</td>
                      <td className="py-2 font-medium">{e.action.replace(/_/g, ' ')}</td>
                      <td className="py-2 text-slate-500">
                        {e.entity ?? '—'}
                        {e.entity_id ? ` #${e.entity_id}` : ''}
                      </td>
                      <td className="py-2 max-w-xs truncate font-mono text-xs text-slate-500" title={detailsText(e.details)}>
                        {detailsText(e.details) || '—'}
                      </td>
                      <td className="py-2 font-mono text-xs text-slate-400">{e.ip ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>
                Page {data?.page ?? page} of {totalPages} · {data?.total ?? 0} entries
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={(data?.page ?? page) <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={(data?.page ?? page) >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
  
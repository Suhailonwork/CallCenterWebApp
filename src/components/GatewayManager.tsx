'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Button } from '@/components/Button';

export interface GsmGateway {
  id:         number;
  name:       string;
  ip:         string;
  port:       number;
  channels:   number;
  status:     'active' | 'inactive';
  notes:      string | null;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-red-100 text-red-600',
};

export function GatewayManager() {
  const [gateways, setGateways] = useState<GsmGateway[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [editGw, setEditGw]     = useState<GsmGateway | null>(null);

  // Tracks pending delayed-refresh timers so we can clean them up.
  const refreshTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // form state
  const [name,     setName]     = useState('');
  const [ip,       setIp]       = useState('');
  const [port,     setPort]     = useState(5060);
  const [channels, setChannels] = useState(1);
  const [status,   setStatus]   = useState<'active' | 'inactive'>('active');
  const [notes,    setNotes]    = useState('');

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/gateways', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setGateways(data.gateways);
      else toast.error(data.error ?? 'Failed to load gateways');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Refresh now, then again a couple of seconds later. After add/edit/delete the
   * server reloads PJSIP and qualifies the gateway, which takes ~1.5–2s before the
   * real online/offline state is known. The delayed refresh picks that up so the UI
   * shows the correct status without the user having to reload the page.
   */
  function refreshWithStatusCatchup() {
    load();
    const t1 = setTimeout(() => load(), 2500);
    const t2 = setTimeout(() => load(), 5000);
    refreshTimers.current.push(t1, t2);
  }

  useEffect(() => {
    load();
    return () => {
      // Clean up any pending timers on unmount.
      refreshTimers.current.forEach((t) => clearTimeout(t));
      refreshTimers.current = [];
    };
  }, []);

  function openCreate() {
    setEditGw(null);
    setName(''); setIp(''); setPort(5060);
    setChannels(1); setStatus('active'); setNotes('');
    setShowForm(true);
  }

  function openEdit(gw: GsmGateway) {
    setEditGw(gw);
    setName(gw.name); setIp(gw.ip); setPort(gw.port);
    setChannels(gw.channels); setStatus(gw.status);
    setNotes(gw.notes ?? '');
    setShowForm(true);
  }

  async function save() {
    if (!name.trim() || !ip.trim()) {
      toast.warning('Name and IP are required');
      return;
    }
    setSaving(true);
    try {
      const body = { name, ip, port, channels, status, notes: notes || null };
      const res  = editGw
        ? await fetch(`/api/admin/gateways/${editGw.id}`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
          })
        : await fetch('/api/admin/gateways', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Save failed'); return; }
      toast.success(editGw ? 'Gateway updated — checking status…' : 'Gateway created — checking status…');
      setShowForm(false);
      refreshWithStatusCatchup();
    } catch { toast.error('Network error'); }
    finally   { setSaving(false); }
  }

  async function remove(gw: GsmGateway) {
    if (!confirm(`Delete gateway "${gw.name}"? This is only allowed if no campaign uses it.`)) return;
    const res = await fetch(`/api/admin/gateways/${gw.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { toast.success('Gateway deleted'); refreshWithStatusCatchup(); }
    else        { toast.error(data.error ?? 'Delete failed'); }
  }

  async function toggleStatus(gw: GsmGateway) {
    const next = gw.status === 'active' ? 'inactive' : 'active';
    const res  = await fetch(`/api/admin/gateways/${gw.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: next }),
    });
    if (res.ok) { toast.success(`Gateway marked ${next} — checking status…`); refreshWithStatusCatchup(); }
    else        { toast.error('Update failed'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">GSM Gateways</h1>
        <button
          onClick={openCreate}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          + New gateway
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total gateways',  value: gateways.length },
          { label: 'Active',          value: gateways.filter((g) => g.status === 'active').length },
          { label: 'Inactive',        value: gateways.filter((g) => g.status === 'inactive').length },
          { label: 'Total channels',  value: gateways.filter((g) => g.status === 'active').reduce((s, g) => s + g.channels, 0) },
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
        ) : gateways.length === 0 ? (
          <p className="text-sm text-slate-400">No GSM gateways configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-400">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">IP : Port</th>
                  <th className="pb-2">Channels</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Endpoint</th>
                  <th className="pb-2">Notes</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {gateways.map((gw) => (
                  <tr key={gw.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 font-medium">{gw.name}</td>
                    <td className="py-2 font-mono text-slate-600">{gw.ip}:{gw.port}</td>
                    <td className="py-2">{gw.channels}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[gw.status] ?? ''}`}>
                        {gw.status}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-xs text-slate-600">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5">gw{gw.id}</span>
                    </td>
                    <td className="py-2 text-slate-400">{gw.notes ?? '—'}</td>
                    <td className="py-2 text-right space-x-1">
                      <button
                        onClick={() => openEdit(gw)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleStatus(gw)}
                        className={`rounded px-2 py-1 text-xs font-medium border ${
                          gw.status === 'active'
                            ? 'border-amber-300 text-amber-600 hover:bg-amber-50'
                            : 'border-green-300 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {gw.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => remove(gw)}
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

      <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-xs text-green-800">
        <p className="font-semibold">✅ Asterisk Realtime enabled</p>
        <p className="mt-1">
          Gateways are provisioned automatically in Asterisk when added or updated here.
          No <code className="mx-1 rounded bg-green-100 px-1">pjsip.conf</code> editing needed.
          Set the <strong>Asterisk Endpoint</strong> name to match your PJSIP trunk (e.g. <code className="rounded bg-green-100 px-1">dinstar</code>).
        </p>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold">
              {editGw ? 'Edit gateway' : 'New GSM Gateway'}
            </h2>

            <label className="mt-4 block text-sm font-medium text-slate-700">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dinstar-Floor1"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">IP Address</label>
                <input value={ip} onChange={(e) => setIp(e.target.value)}
                  placeholder="192.168.0.247"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">SIP Port</label>
                <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">GSM Channels</label>
                <input type="number" min={1} value={channels} onChange={(e) => setChannels(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {editGw && (
              <p className="mt-3 text-xs text-slate-500 rounded bg-slate-50 px-3 py-2 border border-slate-200">
                Asterisk endpoint: <code className="font-mono font-semibold text-indigo-600">gw{editGw.id}</code>
                <span className="ml-1">(auto-generated — no manual input needed)</span>
              </p>
            )}

            <label className="mt-3 block text-sm font-medium text-slate-700">Notes (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 8-channel Dinstar, Room 3"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />

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
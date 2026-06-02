'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import type { AdminUser, TeamSummary, Role } from '@/types';

const ROLES: Role[] = ['manager', 'tl', 'employee', 'admin'];
const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  tl: 'bg-teal-100 text-teal-700',
  employee: 'bg-slate-100 text-slate-600',
};

export function UserManager() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | AdminUser | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('employee');
  const [teamId, setTeamId] = useState(0);

  const editUser = modal && modal !== 'create' ? modal : null;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
        setTeams(data.teams);
      } else {
        toast.error(data.error ?? 'Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setName('');
    setEmail('');
    setPassword('');
    setRole('employee');
    setTeamId(0);
    setModal('create');
  }

  function openEdit(u: AdminUser) {
    setName(u.name);
    setEmail(u.email);
    setPassword('');
    setRole(u.role);
    setTeamId(u.team_id ?? 0);
    setModal(u);
  }

  async function submit() {
    setSaving(true);
    try {
      const needsTeam = role === 'employee' || role === 'tl';
      let res: Response;
      if (editUser) {
        res = await fetch(`/api/admin/users/${editUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            teamId: needsTeam && teamId > 0 ? teamId : null,
            password: password || undefined,
          }),
        });
      } else {
        res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            password,
            role,
            teamId: needsTeam && teamId > 0 ? teamId : null,
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Save failed');
        return;
      }
      toast.success(
        editUser
          ? 'User updated'
          : data.extension
            ? `Employee created — SIP extension ${data.extension}`
            : 'User created',
      );
      setModal(null);
      load();
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: AdminUser) {
    const res = u.is_active
      ? await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
      : await fetch(`/api/admin/users/${u.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: true }),
        });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? 'Update failed');
      return;
    }
    toast.success(u.is_active ? 'User deactivated' : 'User activated');
    load();
  }

  const needsTeam = role === 'employee' || role === 'tl';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Users &amp; Teams</h1>
        <button
          onClick={openCreate}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          + New user
        </button>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-400">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Team</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 font-medium">{u.name}</td>
                    <td className="py-2 text-slate-500">{u.email}</td>
                    <td className="py-2">
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-xs font-medium ' +
                          (ROLE_BADGE[u.role] ?? '')
                        }
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 text-slate-500">{u.team_name ?? '—'}</td>
                    <td className="py-2">
                      <span
                        className={
                          'text-xs font-medium ' +
                          (u.is_active ? 'text-green-600' : 'text-red-500')
                        }
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => openEdit(u)}
                        className="mr-2 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(u)}
                        className={
                          'rounded px-2 py-1 text-xs font-medium ' +
                          (u.is_active
                            ? 'border border-red-300 text-red-600 hover:bg-red-50'
                            : 'border border-green-300 text-green-600 hover:bg-green-50')
                        }
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold">
              {editUser ? 'Edit user' : 'New user'}
            </h2>

            <label className="mt-4 block text-sm font-medium text-slate-700">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <label className="mt-3 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              disabled={!!editUser}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            />

            <label className="mt-3 block text-sm font-medium text-slate-700">
              {editUser ? 'New password (leave blank to keep)' : 'Password'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editUser ? '••••••••' : 'min. 8 characters'}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <label className="mt-3 block text-sm font-medium text-slate-700">Role</label>
            <select
              value={role}
              disabled={!!editUser}
              onChange={(e) => setRole(e.target.value as Role)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm capitalize disabled:bg-slate-100"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {needsTeam && (
              <>
                <label className="mt-3 block text-sm font-medium text-slate-700">
                  Team
                </label>
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value={0}>No team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={submit}
                disabled={saving}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setModal(null)}
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

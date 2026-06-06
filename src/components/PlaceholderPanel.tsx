'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

interface Props {
  user: { name: string; email: string; role: string };
  title: string;
  phase: string;
  planned: string[];
}

export function PlaceholderPanel({ user, title, phase, planned }: Props) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast.info('Signed out');
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            CC
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">{title}</h1>
            <p className="text-xs capitalize text-slate-500">{user.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">{user.name}</span>
          <button
            onClick={logout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            {phase}
          </span>
          <h2 className="mt-4 text-lg font-semibold">Welcome, {user.name}</h2>
          <p className="mt-1 text-sm text-slate-600">
            Authentication and role-based access are live. This console is built
            in a later phase — here is what it will include:
          </p>
          <ul className="mt-4 space-y-2">
            {planned.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-0.5 text-indigo-500">•</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}

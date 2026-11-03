'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { Button } from '@/components/Button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      // A server error page is not JSON — report it as a failed login rather
      // than as "the server is not running".
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Login failed');
        return;
      }
      toast.success(`Welcome, ${data.user.name}`);
      router.replace(data.redirect);
      router.refresh();
    } catch {
      toast.error('Network error - is the server running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
            CC
          </div>
          <h1 className="text-xl font-semibold">Call Center Platform</h1>
          <p className="text-sm text-slate-500">Sign in to your account</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" loading={loading} className="w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

      </div>
    </div>
  );
}

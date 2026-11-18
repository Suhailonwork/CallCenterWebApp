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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-2">
        {/* ── Left brand panel ── */}
        <div className="relative hidden flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-emerald-500 p-10 text-center text-white md:flex">
          {/* Soft decorative circles */}
          <span className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <span className="pointer-events-none absolute -bottom-12 -right-8 h-48 w-48 rounded-full bg-white/10" />

          <div className="relative z-10 flex flex-col items-center">
            {/* SSS Communications logo mark */}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sss-logo.webp"
                alt="SSS Communications"
                className="h-12 w-12 object-contain"
              />
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight">SSS COMMUNICATIONS</h2>

            <h3 className="mt-8 text-2xl font-bold tracking-tight">Ready for your shift?</h3>
            <p className="mt-2 max-w-xs text-sm text-white/80">
              Sign in and start taking calls.
            </p>

            {/* Waveform */}
            <div className="mt-10 flex items-end gap-1.5" aria-hidden="true">
              {[14, 26, 38, 52, 30, 44, 22, 36, 18].map((h, i) => (
                <span
                  key={i}
                  className="w-1.5 rounded-full bg-white/80"
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Right sign-in panel ── */}
        <div className="p-8 sm:p-10">
          {/* Logo shown on small screens where the left panel is hidden */}
          <div className="mb-6 flex items-center gap-2 md:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sss-logo.webp"
              alt="SSS Communications"
              className="h-9 w-9 object-contain"
            />
            <span className="text-sm font-bold tracking-tight text-slate-800">
              SSS COMMUNICATIONS
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Agent sign in</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Enter your username and password.
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Username
              </label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Enter your username"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Enter your password"
              />
            </div>
            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            SSS Communications · Authorized users only · Keep your password private
          </p>
        </div>
      </div>
    </div>
  );
}

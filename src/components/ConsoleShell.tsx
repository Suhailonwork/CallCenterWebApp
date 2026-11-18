'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Megaphone,
  ListChecks,
  PhoneCall,
  Router,
  BarChart3,
  KeyRound,
  ScrollText,
  Coffee,
  Contact,
  CalendarCheck,
  Settings,
  PhoneIncoming,
  LogOut,
  Circle,
  type LucideIcon,
} from 'lucide-react';
import { LiveRefresh } from './LiveRefresh';
import { AttendanceHeartbeat } from './AttendanceHeartbeat';
import { SessionGuard } from './SessionGuard';
import { resetSocket } from '@/lib/useSocket';

interface NavItem {
  href: string;
  label: string;
}

/** Pick a sensible icon from the item's label — keyword based so it works for
 * every role's menu without each layout having to name an icon. */
function iconFor(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (l.includes('dashboard')) return LayoutDashboard;
  if (l.includes('group')) return UsersRound;
  if (l.includes('user')) return Users;
  if (l.includes('campaign')) return Megaphone;
  if (l.includes('list')) return ListChecks;
  if (l.includes('dialer')) return PhoneCall;
  if (l.includes('gateway')) return Router;
  if (l.includes('report')) return BarChart3;
  if (l.includes('login')) return KeyRound;
  if (l.includes('audit')) return ScrollText;
  if (l.includes('break')) return Coffee;
  if (l.includes('customer')) return Contact;
  if (l.includes('attendance')) return CalendarCheck;
  if (l.includes('setting')) return Settings;
  if (l.includes('inbound')) return PhoneIncoming;
  return Circle;
}

export function ConsoleShell({
  roleLabel,
  userName,
  nav,
  children,
}: {
  roleLabel: string;
  userName: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const current = nav.find((n) => n.href === pathname);
  const initial = (userName || '?').trim().charAt(0).toUpperCase();

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      toast.error('Could not sign out — check your connection and try again');
      return;
    }
    // The realtime connection is bound to the session it opened with.
    resetSocket();
    toast.info('Signed out');
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <LiveRefresh scopes={['calls', 'breaks']} />
      <AttendanceHeartbeat />
      <SessionGuard />

      {/* ---------------------------------------------------------- sidebar -- */}
      <aside className="flex w-60 shrink-0 flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-300 ring-1 ring-white/5">
        {/* brand */}
        <div className="flex items-center gap-3 px-5 pb-4 pt-5">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/95 shadow-lg shadow-cyan-500/10 ring-1 ring-white/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sss-logo.webp" alt="SSS" className="h-8 w-8 object-contain" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">{roleLabel}</div>
            <div className="text-[11px] font-medium text-cyan-300/80">SSS Communications</div>
          </div>
        </div>

        <div className="px-5 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Menu
        </div>

        {/* nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {nav.map((item) => {
            const active = pathname === item.href;
            const Icon = iconFor(item.label);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ' +
                  (active
                    ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white')
                }
              >
                {active && (
                  <span className="absolute -left-3 top-1/2 h-6 -translate-y-1/2 rounded-r-full bg-cyan-300" style={{ width: 3 }} />
                )}
                <Icon
                  className={
                    'h-[18px] w-[18px] shrink-0 transition-colors ' +
                    (active ? 'text-white' : 'text-slate-500 group-hover:text-cyan-300')
                  }
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* user + sign out */}
        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 text-xs font-bold text-white">
              {initial}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium text-white">{userName}</div>
              <div className="text-[11px] text-slate-400">Signed in</div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-500/15 hover:text-rose-300"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------ main -- */}
      <div className="flex flex-1 flex-col bg-slate-100">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur">
          <div className="leading-tight">
            <div className="text-base font-semibold text-slate-900">
              {current?.label ?? roleLabel}
            </div>
            <div className="text-xs text-slate-400">{roleLabel}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full bg-slate-100 py-1 pl-1 pr-3 sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 text-xs font-bold text-white">
                {initial}
              </span>
              <span className="text-sm font-medium text-slate-700">{userName}</span>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

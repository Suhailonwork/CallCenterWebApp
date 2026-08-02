'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { LiveRefresh } from './LiveRefresh';
import { AttendanceHeartbeat } from './AttendanceHeartbeat';

const NAV = [
  { href: '/employee/dashboard', label: 'Dashboard' },
  { href: '/employee/attendance', label: 'My Attendance' },
  // { href: '/employee/dialer', label: 'Dialer' },
];

export function EmployeeShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast.info('Signed out');
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <LiveRefresh scopes={['calls', 'breaks']} />
      <AttendanceHeartbeat />
      <aside className="flex w-52 shrink-0 flex-col bg-slate-900 text-slate-300">
        <div className="flex items-center gap-2 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            CC
          </div>
          <span className="text-sm font-semibold text-white">Call Center</span>
        </div>
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  'block rounded-lg px-3 py-2 text-sm font-medium ' +
                  (active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800')
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-3 text-xs text-slate-500">Employee workspace</div>
      </aside>

      <div className="flex flex-1 flex-col bg-slate-100">
        <header className="flex items-center justify-between border-b bg-white px-6 py-3">
          <span className="text-sm font-medium text-slate-500">
            {NAV.find((n) => n.href === pathname)?.label ?? 'Employee'}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-700">{userName}</span>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

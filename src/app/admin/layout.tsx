import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { ConsoleShell } from '@/components/ConsoleShell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/');

  return (
    <ConsoleShell
      roleLabel="Admin Console"
      userName={user.name}
      nav={[
        { href: '/admin/dashboard', label: 'Dashboard' },
        { href: '/admin/users', label: 'Users & Teams' },
        { href: '/admin/groups', label: 'Groups' },
        { href: '/admin/campaigns', label: 'Campaigns' },
        { href: '/admin/lists', label: 'Lists' },
        { href: '/admin/dialer', label: 'Live Dialer' },
        { href: '/admin/gateways', label: 'GSM Gateways' },
        { href: '/admin/reports', label: 'Reports' },
        { href: '/admin/logins', label: 'Logins' },
        { href: '/admin/audit', label: 'Audit Log' },
      ]}
    >
      {children}
    </ConsoleShell>
  );
}

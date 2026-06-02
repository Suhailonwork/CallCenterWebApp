import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { ConsoleShell } from '@/components/ConsoleShell';

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'manager') redirect('/');

  return (
    <ConsoleShell
      roleLabel="Manager Console"
      userName={user.name}
      nav={[
        { href: '/manager/dashboard', label: 'Dashboard' },
        { href: '/manager/campaigns', label: 'Campaigns' },
        { href: '/manager/breaks', label: 'Break Requests' },
      ]}
    >
      {children}
    </ConsoleShell>
  );
}

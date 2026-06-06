import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { ConsoleShell } from '@/components/ConsoleShell';

export default async function TeamLeadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'tl') redirect('/');

  return (
    <ConsoleShell
      roleLabel="Team Lead Console"
      userName={user.name}
      nav={[
        { href: '/tl/dashboard', label: 'Dashboard' },
        { href: '/tl/breaks', label: 'Break Requests' },
      ]}
    >
      {children}
    </ConsoleShell>
  );
}

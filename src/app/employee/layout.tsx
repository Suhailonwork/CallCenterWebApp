import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { EmployeeShell } from '@/components/EmployeeShell';

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'employee') redirect('/');

  return <EmployeeShell userName={user.name}>{children}</EmployeeShell>;
}

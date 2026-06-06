import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { ROLE_HOME } from '@/lib/rbac';

export default async function HomePage() {
  const session = await getSession();
  redirect(session ? ROLE_HOME[session.role] : '/login');
}

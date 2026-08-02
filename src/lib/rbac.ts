import type { Role } from '@/types';

/** Landing page for each role after login. */
export const ROLE_HOME: Record<Role, string> = {
  admin: '/admin/dashboard',
  manager: '/manager/dashboard',
  tl: '/tl/dashboard',
  employee: '/employee/dashboard',
};

/** The role a given URL path belongs to (for route protection). */
export function roleForPath(pathname: string): Role | null {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/manager')) return 'manager';
  if (pathname.startsWith('/tl')) return 'tl';
  if (pathname.startsWith('/employee')) return 'employee';
  return null;
}

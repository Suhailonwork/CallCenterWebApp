import { authenticate, isError, ok } from '@/lib/api';
import { tlsUnderManager, employeesUnderManager } from '@/lib/org';
import { statsForEmployees } from '@/lib/orgMetrics';

export const runtime = 'nodejs';

/** GET /api/manager/overview - the manager's TLs, employees and stats. */
export async function GET() {
  const u = await authenticate(['manager']);
  if (isError(u)) return u;

  const [tls, employees] = await Promise.all([
    tlsUnderManager(u.id),
    employeesUnderManager(u.id),
  ]);
  const stats = await statsForEmployees(employees.map((e) => e.id));
  return ok({ tls, employees, stats });
}

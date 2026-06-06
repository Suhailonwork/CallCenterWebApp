import { authenticate, isError, ok } from '@/lib/api';
import { employeesUnderTL } from '@/lib/org';
import { statsForEmployees } from '@/lib/orgMetrics';

export const runtime = 'nodejs';

/** GET /api/tl/overview - the team lead's employees and their stats. */
export async function GET() {
  const u = await authenticate(['tl']);
  if (isError(u)) return u;

  const employees = await employeesUnderTL(u.id);
  const stats = await statsForEmployees(employees.map((e) => e.id));
  return ok({ employees, stats });
}

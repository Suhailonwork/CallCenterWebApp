import { authenticate, isError, ok } from '@/lib/api';
import { getEmployeeDashboard } from '@/lib/metrics';

export const runtime = 'nodejs';

/** GET /api/employee/dashboard - KPIs, 7-day chart, recent + scheduled calls. */
export async function GET() {
  const user = await authenticate(['employee']);
  if (isError(user)) return user;

  const data = await getEmployeeDashboard(user.id);
  return ok(data);
}

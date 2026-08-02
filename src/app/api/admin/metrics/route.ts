import { authenticate, isError, ok } from '@/lib/api';
import { systemKpis, statsForEmployees } from '@/lib/orgMetrics';
import { listUsers } from '@/lib/org';

export const runtime = 'nodejs';

/** GET /api/admin/metrics - system KPIs + per-employee stats. */
export async function GET() {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const kpis = await systemKpis();
  const users = await listUsers();
  const stats = await statsForEmployees(
    users.filter((x) => x.role === 'employee').map((x) => x.id),
  );
  return ok({ kpis, stats });
}

import { authenticate, isError, ok } from '@/lib/api';
import { employeesUnderManager } from '@/lib/org';
import { tlTeam } from '@/lib/groups';
import { breaksForEmployees } from '@/lib/breaks';

export const runtime = 'nodejs';

/** GET /api/breaks - pending + active breaks for the caller's team. */
export async function GET() {
  const u = await authenticate(['manager', 'tl']);
  if (isError(u)) return u;

  const employees =
    u.role === 'manager'
      ? await employeesUnderManager(u.id)
      : await tlTeam(u.id); // reports_to + group agents

  const breaks = await breaksForEmployees(
    employees.map((e) => e.id),
    ['requested', 'active'],
  );
  return ok({ breaks });
}

import { authenticate, isError, ok } from '@/lib/api';
import { employeesUnderTL } from '@/lib/org';
import { statsForEmployees } from '@/lib/orgMetrics';
import { agentsInTLGroups } from '@/lib/groups';

export const runtime = 'nodejs';

/**
 * GET /api/tl/overview - the team lead's employees and their stats.
 * Includes both the legacy reporting line (users.reports_to) and the
 * agents of the TL's groups, deduped.
 */
export async function GET() {
  const u = await authenticate(['tl']);
  if (isError(u)) return u;

  const direct = await employeesUnderTL(u.id);
  const groupAgents = await agentsInTLGroups(u.id);
  const seen = new Set(direct.map((e) => e.id));
  const employees = [...direct, ...groupAgents.filter((e) => !seen.has(e.id))];

  const stats = await statsForEmployees(employees.map((e) => e.id));
  return ok({ employees, stats });
}

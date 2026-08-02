import { authenticate, isError, ok } from '@/lib/api';
import { query } from '@/lib/db';
import { groupIdsForTL } from '@/lib/groups';

export const runtime = 'nodejs';

/** GET /api/tl/groups - the groups this TL runs, with their agents. */
export async function GET() {
  const u = await authenticate(['tl']);
  if (isError(u)) return u;

  const ids = await groupIdsForTL(u.id);
  if (ids.length === 0) return ok({ groups: [] });

  const ph = ids.map(() => '?').join(',');
  const groups = await query<any>(
    `SELECT id, name, description FROM \`groups\` WHERE id IN (${ph}) ORDER BY name`,
    ids,
  );
  const agents = await query<any>(
    `SELECT ga.group_id, u.id, u.name, u.email,
            COALESCE(e.status, 'offline') AS status
       FROM group_agents ga
       JOIN users u ON u.id = ga.agent_id AND u.is_active = 1
       LEFT JOIN employees e ON e.user_id = u.id
      WHERE ga.group_id IN (${ph})
      ORDER BY u.name`,
    ids,
  );

  const result = groups.map((g: any) => ({
    ...g,
    agents: agents.filter((a: any) => a.group_id === g.id)
      .map((a: any) => ({ id: a.id, name: a.name, email: a.email, status: a.status })),
  }));
  return ok({ groups: result });
}

import { authenticate, isError, ok } from '@/lib/api';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/employee/campaigns
 * Active campaigns this agent may work: either directly assigned by an
 * admin/manager (campaign_assignments) or belonging to one of the agent's
 * groups (group_agents -> campaigns.group_id). Agents cannot reach
 * campaigns outside their assignments / groups.
 */
export async function GET() {
  const user = await authenticate(['employee']);
  if (isError(user)) return user;

  const campaigns = await query<any>(
    `SELECT DISTINCT c.id, c.name, c.description, c.script, c.status, c.dialer_type
       FROM campaigns c
      WHERE c.status = 'active'
        AND (EXISTS (SELECT 1 FROM campaign_assignments ca
                      WHERE ca.campaign_id = c.id AND ca.employee_id = ?)
          OR EXISTS (SELECT 1 FROM group_agents ga
                      WHERE ga.group_id = c.group_id AND ga.agent_id = ?))
      ORDER BY c.name ASC`,
    [user.id, user.id],
  );

  if (campaigns.length === 0) return ok({ campaigns: [] });

  // Attach gateway info (asterisk_endpoint) for routing
  const ids = campaigns.map((c: any) => c.id);
  const gwRows = await query<any>(
    `SELECT cg.campaign_id, g.id, g.name, g.asterisk_endpoint
       FROM campaign_gateways cg
       JOIN gsm_gateways g ON g.id = cg.gateway_id
      WHERE cg.campaign_id IN (${ids.map(() => '?').join(',')}) AND g.status = 'active'`,
    ids,
  );

  const gwMap: Record<number, any[]> = {};
  for (const row of gwRows) {
    if (!gwMap[row.campaign_id]) gwMap[row.campaign_id] = [];
    gwMap[row.campaign_id].push({ id: row.id, name: row.name, asterisk_endpoint: row.asterisk_endpoint });
  }

  const result = campaigns.map((c: any) => ({ ...c, gateways: gwMap[c.id] ?? [] }));
  return ok({ campaigns: result });
}

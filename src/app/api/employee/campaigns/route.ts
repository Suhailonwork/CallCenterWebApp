import { authenticate, isError, ok } from '@/lib/api';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/employee/campaigns
 * Only the active campaigns this agent has been assigned to by an
 * admin or manager. Agents cannot choose campaigns themselves.
 */
export async function GET() {
  const user = await authenticate(['employee']);
  if (isError(user)) return user;

  const campaigns = await query<any>(
    `SELECT c.id, c.name, c.description, c.script, c.status, c.dialer_type
       FROM campaigns c
       JOIN campaign_assignments ca ON ca.campaign_id = c.id
      WHERE ca.employee_id = ? AND c.status = 'active'
      ORDER BY c.name ASC`,
    [user.id],
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

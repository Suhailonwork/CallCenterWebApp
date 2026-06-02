import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { query, pool } from '@/lib/db';
import type { CampaignRow } from '@/types';

export const runtime = 'nodejs';

/** GET /api/admin/campaigns - campaigns with contact progress + assigned gateways. */
export async function GET() {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const campaigns = await query<CampaignRow>(
    `SELECT c.id, c.name, c.description, c.status, c.dialer_type,
            DATE_FORMAT(c.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,
            COUNT(DISTINCT d.id)  AS total_contacts,
            COALESCE(SUM(d.called), 0) AS called_contacts
       FROM campaigns c
       LEFT JOIN csv_data d ON d.campaign_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC`,
  );

  // Attach gateway list to each campaign
  const gatewayRows = await query<{ campaign_id: number; gateway_id: number; name: string; ip: string; port: number; channels: number; status: string }>(
    `SELECT cg.campaign_id, g.id AS gateway_id, g.name, g.ip, g.port, g.channels, g.status
       FROM campaign_gateways cg
       JOIN gsm_gateways g ON g.id = cg.gateway_id`,
  );

  const gwMap: Record<number, typeof gatewayRows> = {};
  for (const row of gatewayRows) {
    if (!gwMap[row.campaign_id]) gwMap[row.campaign_id] = [];
    gwMap[row.campaign_id].push(row);
  }

  const result = campaigns.map((c) => ({ ...c, gateways: gwMap[c.id] ?? [] }));
  return ok({ campaigns: result });
}

const DIALER_TYPES = ['predictive', 'manual', 'inbound', 'ratio'] as const;

const createSchema = z.object({
  name:        z.string().min(1).max(150),
  description: z.string().max(2000).nullable().optional(),
  script:      z.string().max(4000).nullable().optional(),
  dialer_type: z.enum(DIALER_TYPES).optional().default('manual'),
  gatewayIds:  z.array(z.number().int().positive()).optional().default([]),
});

/** POST /api/admin/campaigns - create a campaign with optional gateway assignments. */
export async function POST(req: Request) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid campaign data');
  const d = parsed.data;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [res]: any = await conn.execute(
      `INSERT INTO campaigns (name, description, script, created_by, status, dialer_type)
       VALUES (?,?,?,?, 'active', ?)`,
      [d.name, d.description ?? null, d.script ?? null, u.id, d.dialer_type],
    );
    const campaignId: number = res.insertId;

    // Assign gateways
    if (d.gatewayIds.length > 0) {
      const placeholders = d.gatewayIds.map(() => '(?, ?)').join(', ');
      const vals = d.gatewayIds.flatMap((gid) => [campaignId, gid]);
      await conn.execute(
        `INSERT IGNORE INTO campaign_gateways (campaign_id, gateway_id) VALUES ${placeholders}`,
        vals,
      );
    }

    await conn.execute(
      'INSERT INTO audit_logs (user_id, action, entity, entity_id) VALUES (?,?,?,?)',
      [u.id, 'create_campaign', 'campaigns', campaignId],
    );

    await conn.commit();
    return ok({ id: campaignId }, 201);
  } catch (e) {
    await conn.rollback();
    console.error('[campaigns] create failed:', e);
    return fail('Failed to create campaign', 500);
  } finally {
    conn.release();
  }
}

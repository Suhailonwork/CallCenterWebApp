import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { query, queryOne, pool } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { DEFAULT_DIAL_STATUSES, DEFAULT_RECYCLE_RULES } from '@/lib/dialEligibility';
import { dialStatusesSchema, recycleRulesSchema } from '@/lib/lists';
import type { CampaignRow } from '@/types';

export const runtime = 'nodejs';

/** GET /api/admin/campaigns - campaigns with contact progress + assigned gateways. */
export async function GET() {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const campaigns = await query<CampaignRow>(
    `SELECT c.id, c.name, c.description, c.status, c.dialer_type,
            c.group_id, grp.name AS group_name,
            c.dial_statuses, c.recycle_rules,
            DATE_FORMAT(c.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,
            COUNT(DISTINCT d.id)  AS total_contacts,
            COALESCE(SUM(d.called), 0) AS called_contacts
       FROM campaigns c
       LEFT JOIN \`groups\` grp ON grp.id = c.group_id
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
  recording_enabled: z.boolean().optional().default(false),
  group_id:    z.number().int().positive().nullable().optional(),
  data_table_id: z.number().int().positive().nullable().optional(),
  dial_statuses: dialStatusesSchema.optional(),
  recycle_rules: recycleRulesSchema.optional(),
});

/** POST /api/admin/campaigns - create a campaign with optional gateway assignments. */
export async function POST(req: Request) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid campaign data');
  const d = parsed.data;

  // Optional group ownership — validate the group exists before inserting.
  if (d.group_id != null) {
    const grp = await queryOne('SELECT id FROM `groups` WHERE id = ?', [d.group_id]);
    if (!grp) return fail('Selected group not found');
  }

  // Optional data table — validate it exists before inserting.
  if (d.data_table_id != null) {
    const dt = await queryOne('SELECT id FROM data_tables WHERE id = ?', [d.data_table_id]);
    if (!dt) return fail('Selected data table not found');
  }

  // A campaign MUST route through a GSM gateway — make it mandatory so calls
  // never fall back to a missing endpoint ("Endpoint not set") at dial time.
  if (!d.gatewayIds || d.gatewayIds.length === 0) {
    return fail('Select at least one GSM gateway for this campaign');
  }
  {
    const ph = d.gatewayIds.map(() => '?').join(',');
    const valid = await query<{ id: number }>(
      `SELECT id FROM gsm_gateways WHERE id IN (${ph})`,
      d.gatewayIds,
    );
    if (valid.length !== d.gatewayIds.length) {
      return fail('One or more selected gateways do not exist');
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [res]: any = await conn.execute(
      `INSERT INTO campaigns (name, description, script, created_by, group_id, data_table_id, status, dialer_type, recording_enabled, dial_statuses, recycle_rules)
       VALUES (?,?,?,?,?,?, 'active', ?, ?, ?, ?)`,
      [
        d.name, d.description ?? null, d.script ?? null, u.id, d.group_id ?? null,
        d.data_table_id ?? null, d.dialer_type, d.recording_enabled ? 1 : 0,
        JSON.stringify(d.dial_statuses ?? DEFAULT_DIAL_STATUSES),
        JSON.stringify(d.recycle_rules ?? DEFAULT_RECYCLE_RULES),
      ],
    );
    const campaignId: number = res.insertId;

    // Leads always live in a list — every campaign starts with an active
    // Default List (inheriting the campaign's data table as its template).
    await conn.execute(
      `INSERT INTO lists (name, description, campaign_id, active, template_id)
       VALUES ('Default List', NULL, ?, 'Y', ?)`,
      [campaignId, d.data_table_id ?? null],
    );

    // Assign gateways
    if (d.gatewayIds.length > 0) {
      const placeholders = d.gatewayIds.map(() => '(?, ?)').join(', ');
      const vals = d.gatewayIds.flatMap((gid) => [campaignId, gid]);
      await conn.execute(
        `INSERT IGNORE INTO campaign_gateways (campaign_id, gateway_id) VALUES ${placeholders}`,
        vals,
      );
    }

    await logAudit(
      {
        userId: u.id,
        action: 'create_campaign',
        entity: 'campaigns',
        entityId: campaignId,
        details: { name: d.name, dialer_type: d.dialer_type, gatewayIds: d.gatewayIds },
      },
      conn,
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

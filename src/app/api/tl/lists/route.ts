import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool, query, queryOne } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { groupIdsForTL, tlOwnsCampaign } from '@/lib/groups';
import type { ResultSetHeader } from 'mysql2';

export const runtime = 'nodejs';

/**
 * GET /api/tl/lists[?campaignId=N] — lists of campaigns in the TL's groups.
 * Mirror of /api/admin/lists (used by the shared upload modal).
 */
export async function GET(req: Request) {
  const u = await authenticate(['tl']);
  if (isError(u)) return u;

  const campaignIdRaw = new URL(req.url).searchParams.get('campaignId');
  const campaignId = campaignIdRaw == null ? null : Number(campaignIdRaw);
  if (campaignIdRaw != null && (!Number.isInteger(campaignId) || campaignId! <= 0)) {
    return fail('Invalid campaignId');
  }
  if (campaignId != null && !(await tlOwnsCampaign(u.id, campaignId))) {
    return fail('Campaign is not in your group', 403);
  }

  const groupIds = await groupIdsForTL(u.id);
  if (groupIds.length === 0) return ok({ lists: [] });

  try {
    const lists = await query(
      `SELECT l.id, l.name, l.description, l.campaign_id, c.name AS campaign_name,
              l.active, l.template_id, dt.name AS template_name, l.created_at,
              COUNT(d.id)                    AS lead_count,
              COALESCE(SUM(d.called = 0), 0) AS fresh_count,
              MAX(d.last_call_at)            AS last_call_at
         FROM lists l
         JOIN campaigns c ON c.id = l.campaign_id
         LEFT JOIN data_tables dt ON dt.id = l.template_id
         LEFT JOIN csv_data d ON d.list_id = l.id
        WHERE c.group_id IN (${groupIds.map(() => '?').join(',')})
          ${campaignId != null ? 'AND l.campaign_id = ?' : ''}
        GROUP BY l.id
        ORDER BY c.name ASC, l.id ASC`,
      campaignId != null ? [...groupIds, campaignId] : groupIds,
    );
    return ok({
      lists: (lists as any[]).map((l) => ({
        ...l,
        lead_count: Number(l.lead_count),
        fresh_count: Number(l.fresh_count),
      })),
    });
  } catch (e: any) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      return ok({ lists: [], _hint: 'Run npm run db:migrate:lists first' });
    }
    console.error('[tl/lists GET]', e);
    return fail('Failed to load lists', 500);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().max(500).nullable().optional(),
  campaign_id: z.number().int().positive(),
  template_id: z.number().int().positive().nullable().optional(),
  active: z.enum(['Y', 'N']).optional().default('Y'),
});

/** POST /api/tl/lists — create a list on a campaign in the TL's groups. */
export async function POST(req: Request) {
  const u = await authenticate(['tl']);
  if (isError(u)) return u;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid list — provide a name and campaign');
  const d = parsed.data;

  if (!(await tlOwnsCampaign(u.id, d.campaign_id))) {
    return fail('Campaign is not in your group', 403);
  }
  if (d.template_id != null) {
    const dt = await queryOne('SELECT id FROM data_tables WHERE id = ?', [d.template_id]);
    if (!dt) return fail('Data template not found', 404);
  }

  try {
    const [res] = await pool.execute<ResultSetHeader>(
      `INSERT INTO lists (name, description, campaign_id, active, template_id)
       VALUES (?,?,?,?,?)`,
      [d.name, d.description ?? null, d.campaign_id, d.active, d.template_id ?? null],
    );
    await logAudit({
      userId: u.id,
      action: 'create_list',
      entity: 'lists',
      entityId: res.insertId,
      details: { name: d.name, campaignId: d.campaign_id, templateId: d.template_id ?? null, by: 'tl' },
    });
    return ok({ id: res.insertId }, 201);
  } catch (e: any) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      return fail('Database not migrated — run npm run db:migrate:lists first', 503);
    }
    console.error('[tl/lists POST]', e);
    return fail('Failed to create list', 500);
  }
}

import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool, query, queryOne } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { fieldsSchema, normalizeFields } from '@/lib/lists';
import type { ResultSetHeader } from 'mysql2';

export const runtime = 'nodejs';

/**
 * GET /api/admin/lists[?campaignId=N] — all lists (or one campaign's), with
 * lead totals, dialable/per-status breakdown and last call date for the
 * Lists page. TLs get their own scoped mirror under /api/tl/lists.
 */
export async function GET(req: Request) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const campaignIdRaw = new URL(req.url).searchParams.get('campaignId');
  const campaignId = campaignIdRaw == null ? null : Number(campaignIdRaw);
  if (campaignIdRaw != null && (!Number.isInteger(campaignId) || campaignId! <= 0)) {
    return fail('Invalid campaignId');
  }

  try {
    const lists = await query(
      `SELECT l.id, l.name, l.description, l.campaign_id, c.name AS campaign_name,
              l.active, l.fields, l.created_at,
              COUNT(d.id)                            AS lead_count,
              COALESCE(SUM(d.called = 0), 0)         AS fresh_count,
              MAX(d.last_call_at)                    AS last_call_at
         FROM lists l
         JOIN campaigns c ON c.id = l.campaign_id
         LEFT JOIN csv_data d ON d.list_id = l.id
        ${campaignId != null ? 'WHERE l.campaign_id = ?' : ''}
        GROUP BY l.id
        ORDER BY c.name ASC, l.id ASC`,
      campaignId != null ? [campaignId] : [],
    );

    // Per-status counts, one grouped query for all (or the campaign's) lists.
    const statusRows = await query<{ list_id: number; call_status: string; n: number }>(
      `SELECT d.list_id, d.call_status, COUNT(*) AS n
         FROM csv_data d
        ${campaignId != null ? 'WHERE d.campaign_id = ?' : 'WHERE d.list_id IS NOT NULL'}
        GROUP BY d.list_id, d.call_status`,
      campaignId != null ? [campaignId] : [],
    );
    const byList = new Map<number, Record<string, number>>();
    for (const r of statusRows) {
      if (r.list_id == null) continue;
      const m = byList.get(r.list_id) ?? {};
      m[r.call_status] = Number(r.n);
      byList.set(r.list_id, m);
    }

    return ok({
      lists: (lists as any[]).map((l) => ({
        ...l,
        fields: normalizeFields(l.fields),
        lead_count: Number(l.lead_count),
        fresh_count: Number(l.fresh_count),
        status_counts: byList.get(l.id) ?? {},
      })),
    });
  } catch (e: any) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      return ok({ lists: [], _hint: 'Run npm run db:migrate:lists first' });
    }
    console.error('[admin/lists GET]', e);
    return fail('Failed to load lists', 500);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().max(500).nullable().optional(),
  campaign_id: z.number().int().positive(),
  fields: fieldsSchema.optional(),
  active: z.enum(['Y', 'N']).optional().default('Y'),
});

/** POST /api/admin/lists — create a list (also used inline by the upload modal). */
export async function POST(req: Request) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid list — provide a name and campaign');
  const d = parsed.data;

  const campaign = await queryOne('SELECT id FROM campaigns WHERE id = ?', [d.campaign_id]);
  if (!campaign) return fail('Campaign not found', 404);

  const fields = normalizeFields(d.fields);
  try {
    const [res] = await pool.execute<ResultSetHeader>(
      `INSERT INTO lists (name, description, campaign_id, active, fields)
       VALUES (?,?,?,?,?)`,
      [d.name, d.description ?? null, d.campaign_id, d.active, fields ? JSON.stringify(fields) : null],
    );
    await logAudit({
      userId: u.id,
      action: 'create_list',
      entity: 'lists',
      entityId: res.insertId,
      details: { name: d.name, campaignId: d.campaign_id, fields, active: d.active },
    });
    return ok({ id: res.insertId }, 201);
  } catch (e: any) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      return fail('Database not migrated — run npm run db:migrate:lists first', 503);
    }
    console.error('[admin/lists POST]', e);
    return fail('Failed to create list', 500);
  }
}

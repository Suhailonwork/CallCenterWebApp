import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool, query } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { tlOwnsCampaign } from '@/lib/groups';
import {
  dialStatusesSchema,
  recycleRulesSchema,
  pacingSchema,
  applyCampaignPacing,
} from '@/lib/lists';
import { kickDialer } from '@/lib/realtime';

export const runtime = 'nodejs';

const schema = pacingSchema.extend({
  status:      z.enum(['active', 'paused', 'completed']).optional(),
  dialer_type: z.enum(['predictive', 'manual', 'inbound', 'ratio']).optional(),
  gatewayIds:  z.array(z.number().int().positive()).optional(),
  dial_statuses: dialStatusesSchema.optional(),
  recycle_rules: recycleRulesSchema.optional(),
});

/** PATCH /api/tl/campaigns/:id - edit a campaign inside the TL's groups. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['tl']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return fail('Invalid campaign id');

  // RBAC: the campaign must belong to one of this TL's groups.
  if (!(await tlOwnsCampaign(u.id, id))) {
    return fail('Campaign is not in your group', 403);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid data');
  const d = parsed.data;

  if (
    d.dial_statuses !== undefined &&
    d.dial_statuses.length === 0 &&
    d.recycle_rules !== undefined &&
    d.recycle_rules.length === 0
  ) {
    return fail('Select at least one dial status or add a recycle rule — otherwise nothing will dial');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const pacingChanged = (await applyCampaignPacing(conn, id, d)) > 0;
    const dialRulesChanged =
      d.dial_statuses !== undefined ||
      d.recycle_rules !== undefined ||
      d.status !== undefined ||
      d.dialer_type !== undefined ||
      d.gatewayIds !== undefined ||
      pacingChanged;

    if (d.status) {
      await conn.execute('UPDATE campaigns SET status = ? WHERE id = ?', [d.status, id]);
    }
    if (d.dialer_type) {
      await conn.execute('UPDATE campaigns SET dialer_type = ? WHERE id = ?', [d.dialer_type, id]);
    }
    if (d.dial_statuses !== undefined) {
      await conn.execute('UPDATE campaigns SET dial_statuses = ? WHERE id = ?', [
        JSON.stringify(d.dial_statuses),
        id,
      ]);
    }
    if (d.recycle_rules !== undefined) {
      await conn.execute('UPDATE campaigns SET recycle_rules = ? WHERE id = ?', [
        JSON.stringify(d.recycle_rules),
        id,
      ]);
    }
    if (d.gatewayIds !== undefined) {
      // A campaign must always keep at least one gateway — never allow the
      // edit to strip it down to zero (would break dialing).
      if (d.gatewayIds.length === 0) {
        await conn.rollback();
        return fail('A campaign must have at least one GSM gateway assigned');
      }
      if (d.gatewayIds.length > 0) {
        const ph = d.gatewayIds.map(() => '?').join(',');
        const [valid]: any = await conn.execute(
          `SELECT id FROM gsm_gateways WHERE id IN (${ph})`,
          d.gatewayIds,
        );
        const validIds = new Set(valid.map((r: any) => r.id));
        const missing = d.gatewayIds.filter((g) => !validIds.has(g));
        if (missing.length > 0) {
          await conn.rollback();
          return fail(`Gateway id(s) not found: ${missing.join(', ')}`, 400);
        }
      }
      await conn.execute('DELETE FROM campaign_gateways WHERE campaign_id = ?', [id]);
      if (d.gatewayIds.length > 0) {
        const placeholders = d.gatewayIds.map(() => '(?, ?)').join(', ');
        const vals = d.gatewayIds.flatMap((gid) => [id, gid]);
        await conn.execute(
          `INSERT INTO campaign_gateways (campaign_id, gateway_id) VALUES ${placeholders}`,
          vals,
        );
      }
    }

    await logAudit(
      { userId: u.id, action: 'update_campaign', entity: 'campaigns', entityId: id, details: { by: 'tl' } },
      conn,
    );

    await conn.commit();
    const kicked = dialRulesChanged ? kickDialer() : false;
    return ok({ ok: true, dialerRestarted: kicked });
  } catch (e: any) {
    await conn.rollback();
    console.error('[tl campaign PATCH] failed:', e);
    return fail(`Update failed: ${e?.sqlMessage ?? e?.message ?? String(e)}`, 500);
  } finally {
    conn.release();
  }
}

/** DELETE /api/tl/campaigns/:id — delete a campaign in one of the TL's groups
 * (and, by FK cascade, its lists + leads + assignments). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['tl']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail('Invalid campaign id');
  if (!(await tlOwnsCampaign(u.id, id))) {
    return fail('Campaign is not in your group', 403);
  }

  const rows = await query<{ name: string; lists: number; leads: number }>(
    `SELECT c.name,
            (SELECT COUNT(*) FROM lists    l WHERE l.campaign_id = c.id) AS lists,
            (SELECT COUNT(*) FROM csv_data d WHERE d.campaign_id = c.id) AS leads
       FROM campaigns c WHERE c.id = ?`,
    [id],
  );
  if (rows.length === 0) return fail('Campaign not found', 404);
  const info = rows[0];

  await pool.execute('DELETE FROM campaigns WHERE id = ?', [id]);
  await logAudit({
    userId: u.id,
    action: 'delete_campaign',
    entity: 'campaigns',
    entityId: id,
    details: { name: info.name, deletedLists: Number(info.lists), deletedLeads: Number(info.leads), by: 'tl' },
  });
  return ok({ deleted: true, deletedLists: Number(info.lists), deletedLeads: Number(info.leads) });
}

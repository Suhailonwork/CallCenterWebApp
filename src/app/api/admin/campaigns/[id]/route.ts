import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { query, pool } from '@/lib/db';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const schema = z.object({
  status:      z.enum(['active', 'paused', 'completed']).optional(),
  dialer_type: z.enum(['predictive', 'manual', 'inbound', 'ratio']).optional(),
  gatewayIds:  z.array(z.number().int().positive()).optional(),
});

/** PATCH /api/admin/campaigns/:id - change status and/or reassign gateways. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return fail('Invalid campaign id');

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid data');
  const d = parsed.data;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (d.status) {
      await conn.execute('UPDATE campaigns SET status = ? WHERE id = ?', [d.status, id]);
    }

    if (d.dialer_type) {
      await conn.execute('UPDATE campaigns SET dialer_type = ? WHERE id = ?', [d.dialer_type, id]);
    }

    if (d.gatewayIds !== undefined) {
      // Validate the gateway ids exist before inserting, so a stale id gives a
      // clear error instead of a foreign-key 500.
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
      // Full replace: delete existing, insert new set
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
      { userId: u.id, action: 'update_campaign', entity: 'campaigns', entityId: id },
      conn,
    );

    await conn.commit();
    return ok({ ok: true });
  } catch (e: any) {
    await conn.rollback();
    console.error('[campaign PATCH] failed:', e);
    // Surface the real DB error so it is debuggable from the client too.
    return fail(`Update failed: ${e?.sqlMessage ?? e?.message ?? String(e)}`, 500);
  } finally {
    conn.release();
  }
}

/** DELETE /api/admin/campaigns/:id is intentionally not implemented here. */
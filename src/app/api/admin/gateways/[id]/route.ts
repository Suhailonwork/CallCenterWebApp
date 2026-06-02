import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool } from '@/lib/db';
import { provisionGatewayEndpoint, deprovisionGatewayEndpoint, gwEndpoint } from '@/lib/asteriskRealtime';

export const runtime = 'nodejs';

const patchSchema = z.object({
  name:     z.string().min(1).max(100).optional(),
  ip:       z.string().min(7).max(64).optional(),
  port:     z.number().int().min(1).max(65535).optional(),
  channels: z.number().int().min(1).max(256).optional(),
  status:   z.enum(['active', 'inactive']).optional(),
  notes:    z.string().max(255).nullable().optional(),
});

/** PATCH /api/admin/gateways/[id] — update a gateway */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isFinite(id)) return fail('Invalid id');

  try {
    const [rows]: any = await pool.execute('SELECT id FROM gsm_gateways WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return fail('Gateway not found', 404);

    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail('Invalid data');
    const d = parsed.data;

    const sets: string[] = [];
    const vals: any[]    = [];

    if (d.name     !== undefined) { sets.push('name=?');     vals.push(d.name); }
    if (d.ip       !== undefined) { sets.push('ip=?');       vals.push(d.ip); }
    if (d.port     !== undefined) { sets.push('port=?');     vals.push(d.port); }
    if (d.channels !== undefined) { sets.push('channels=?'); vals.push(d.channels); }
    if (d.status   !== undefined) { sets.push('status=?');   vals.push(d.status); }
    if (d.notes    !== undefined) { sets.push('notes=?');    vals.push(d.notes); }

    if (sets.length === 0) return fail('No fields to update');

    vals.push(id);
    await pool.execute(`UPDATE gsm_gateways SET ${sets.join(', ')} WHERE id = ?`, vals);

    // Re-read and re-provision using auto-generated endpoint name gw{id}
    const [updated]: any = await pool.execute(
      'SELECT ip, port, status FROM gsm_gateways WHERE id = ?', [id],
    );
    if (updated?.[0]) {
      const gw = updated[0];
      const endpoint = gwEndpoint(id);
      if (gw.status === 'active') {
        try {
          await provisionGatewayEndpoint(id, gw.ip, gw.port);
          console.log(`[asterisk] re-provisioned ${endpoint} → ${gw.ip}:${gw.port}`);
        } catch (err: any) {
          console.error('[asterisk] re-provision failed:', err?.message);
        }
      } else {
        await deprovisionGatewayEndpoint(id).catch(() => {});
      }
    }

    return ok({ ok: true });
  } catch (e: any) {
    console.error('[gateways PATCH]', e);
    return fail('Update failed', 500);
  }
}

/** DELETE /api/admin/gateways/[id] — remove a gateway */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isFinite(id)) return fail('Invalid id');

  try {
    await pool.execute('DELETE FROM gsm_gateways WHERE id = ?', [id]);
    await pool.execute(
      'INSERT INTO audit_logs (user_id, action, entity, entity_id) VALUES (?,?,?,?)',
      [u.id, 'delete_gateway', 'gsm_gateways', id],
    );
    // Deprovision using auto-generated name — always matches what was provisioned
    await deprovisionGatewayEndpoint(id).catch(() => {});
    return ok({ ok: true });
  } catch (e: any) {
    console.error('[gateways DELETE]', e);
    return fail('Delete failed', 500);
  }
}

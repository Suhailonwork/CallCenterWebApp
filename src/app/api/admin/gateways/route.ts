import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool } from '@/lib/db';
import type { ResultSetHeader } from 'mysql2';
import { provisionGatewayEndpoint, gwEndpoint } from '@/lib/asteriskRealtime';

export const runtime = 'nodejs';

/** GET /api/admin/gateways — list all GSM gateways */
export async function GET() {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  try {
    const [rows] = await pool.execute(
      `SELECT id, name, ip, port, channels, status, asterisk_endpoint, notes, created_at
         FROM gsm_gateways
        ORDER BY name ASC`,
    );
    return ok({ gateways: rows });
  } catch (e: any) {
    // Table may not exist yet — return empty list with a hint instead of crashing
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[gateways] gsm_gateways table missing — run: mysql … < db/add-gsm-gateways.sql');
      return ok({ gateways: [], _hint: 'Run db/add-gsm-gateways.sql migration first' });
    }
    console.error('[gateways GET]', e);
    return fail('Failed to load gateways', 500);
  }
}

const createSchema = z.object({
  name:     z.string().min(1).max(100),
  ip:       z.string().min(7).max(64),
  port:     z.number().int().min(1).max(65535).default(5060),
  channels: z.number().int().min(1).max(256).default(1),
  status:   z.enum(['active', 'inactive']).default('active'),
  notes:    z.string().max(255).nullable().optional(),
});

/** POST /api/admin/gateways — create a GSM gateway */
export async function POST(req: Request) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid gateway data');
  const d = parsed.data;

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO gsm_gateways (name, ip, port, channels, status, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [d.name, d.ip, d.port, d.channels, d.status, d.notes ?? null],
    );
    const newId = result.insertId;

    // Auto-set asterisk_endpoint = gw{id} — never manually typed, always consistent
    const endpoint = gwEndpoint(newId);
    await pool.execute('UPDATE gsm_gateways SET asterisk_endpoint = ? WHERE id = ?', [endpoint, newId]);

    await pool.execute(
      'INSERT INTO audit_logs (user_id, action, entity, entity_id) VALUES (?,?,?,?)',
      [u.id, 'create_gateway', 'gsm_gateways', newId],
    );

    if (d.status === 'active') {
      try {
        await provisionGatewayEndpoint(newId, d.ip, d.port);
        console.log(`[asterisk] provisioned ${endpoint} → ${d.ip}:${d.port}`);
      } catch (err: any) {
        console.error('[asterisk] provision failed:', err?.message);
      }
    }

    return ok({ id: newId, endpoint }, 201);
  } catch (e: any) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      return fail('Database not migrated — run db/add-gsm-gateways.sql first', 503);
    }
    console.error('[gateways POST]', e);
    return fail('Failed to create gateway', 500);
  }
}

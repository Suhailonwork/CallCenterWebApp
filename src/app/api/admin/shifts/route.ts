import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool, query } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import type { Shift } from '@/types';

export const runtime = 'nodejs';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const createSchema = z.object({
  name: z.string().min(1).max(120),
  start_time: z.string().regex(TIME_RE, 'Use HH:MM'),
  end_time: z.string().regex(TIME_RE, 'Use HH:MM'),
  grace_minutes: z.number().int().min(0).max(240).default(15),
  working_hours: z.number().min(0).max(24).nullable().optional(),
  is_active: z.boolean().default(true),
});

/** All shifts (active + inactive) with assigned-user counts. */
async function listShifts(): Promise<Shift[]> {
  return query<Shift>(
    `SELECT s.id, s.name,
            TIME_FORMAT(s.start_time, '%H:%i') AS start_time,
            TIME_FORMAT(s.end_time,   '%H:%i') AS end_time,
            s.grace_minutes, s.working_hours, s.is_active,
            (SELECT COUNT(*) FROM users u WHERE u.shift_id = s.id AND u.is_active = 1) AS assigned_count,
            DATE_FORMAT(s.created_at, '%Y-%m-%d') AS created_at
       FROM shifts s
      ORDER BY s.is_active DESC, s.start_time, s.name`,
  );
}

/** GET /api/admin/shifts — list all shifts. */
export async function GET() {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;
  return ok({ shifts: await listShifts() });
}

/** POST /api/admin/shifts — create a shift. */
export async function POST(req: Request) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid shift data');
  const d = parsed.data;

  const [res]: any = await pool.execute(
    `INSERT INTO shifts (name, start_time, end_time, grace_minutes, working_hours, is_active, created_by)
     VALUES (?,?,?,?,?,?,?)`,
    [d.name, d.start_time, d.end_time, d.grace_minutes, d.working_hours ?? null, d.is_active ? 1 : 0, u.id],
  );
  const id = res.insertId as number;

  await logAudit({ userId: u.id, action: 'create_shift', entity: 'shifts', entityId: id, details: { name: d.name } });
  return ok({ id }, 201);
}

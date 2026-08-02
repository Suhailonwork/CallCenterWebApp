import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { query, queryOne } from '@/lib/db';
import { employeeBreaks } from '@/lib/breaks';
import { broadcastChange } from '@/lib/realtime';

export const runtime = 'nodejs';

/** GET /api/employee/breaks - the employee's break history + current break. */
export async function GET() {
  const u = await authenticate(['employee']);
  if (isError(u)) return u;
  return ok({ breaks: await employeeBreaks(u.id) });
}

const schema = z.object({
  breakType: z.enum(['lunch', 'short', 'other']),
  reason: z.string().max(255).nullable().optional(),
});

/** POST /api/employee/breaks - request a break. */
export async function POST(req: Request) {
  const u = await authenticate(['employee']);
  if (isError(u)) return u;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid break request');

  const existing = await queryOne(
    "SELECT id FROM breaks WHERE employee_id = ? AND status IN ('requested','active')",
    [u.id],
  );
  if (existing) return fail('You already have a pending or active break');

  await query(
    "INSERT INTO breaks (employee_id, break_type, reason, status) VALUES (?,?,?,'requested')",
    [u.id, parsed.data.breakType, parsed.data.reason ?? null],
  );
  broadcastChange('breaks');
  return ok({ ok: true }, 201);
}

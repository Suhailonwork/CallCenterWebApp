import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool, query } from '@/lib/db';
import { broadcastChange } from '@/lib/realtime';

export const runtime = 'nodejs';

const logSchema = z.object({
  phoneNumber: z.string().min(1).max(32),
  contactName: z.string().max(150).nullable().optional(),
  campaignId: z.number().int().positive().nullable().optional(),
  csvDataId: z.number().int().positive().nullable().optional(),
  status: z.enum([
    'connected', 'no_answer', 'busy', 'voicemail', 'failed', 'wrong_number',
  ]),
  durationSeconds: z.number().int().min(0).max(86400),
  note: z.string().max(5000).nullable().optional(),
  tags: z.string().max(255).nullable().optional(),
  followUpAt: z.string().max(40).nullable().optional(),
});

/** POST /api/employee/calls - log a finished call + note + optional follow-up. */
export async function POST(req: Request) {
  const user = await authenticate(['employee']);
  if (isError(user)) return user;

  const parsed = logSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid call data');
  const d = parsed.data;
  const duration = d.durationSeconds; // zod-validated integer - safe to inline

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [callRes]: any = await conn.execute(
      `INSERT INTO calls
         (employee_id, campaign_id, csv_data_id, phone_number, contact_name,
          direction, status, duration_seconds, started_at, ended_at)
       VALUES (?,?,?,?,?, 'outbound', ?, ?,
         DATE_SUB(NOW(), INTERVAL ${duration} SECOND), NOW())`,
      [
        user.id,
        d.campaignId ?? null,
        d.csvDataId ?? null,
        d.phoneNumber,
        d.contactName ?? null,
        d.status,
        duration,
      ],
    );
    const callId = callRes.insertId;

    const followUp = d.followUpAt ? d.followUpAt.replace('T', ' ') : null;

    const [noteRes]: any = await conn.execute(
      `INSERT INTO call_notes (call_id, employee_id, note, tags, follow_up_at)
       VALUES (?,?,?,?,?)`,
      [callId, user.id, d.note ?? null, d.tags ?? null, followUp],
    );

    if (d.csvDataId) {
      await conn.execute(
        'UPDATE csv_data SET called = 1, call_status = ? WHERE id = ?',
        [d.status, d.csvDataId],
      );
    }

    if (followUp) {
      await conn.execute(
        `INSERT INTO scheduled_calls
           (call_note_id, phone_number, contact_name, scheduled_at, assigned_to, status)
         VALUES (?,?,?,?,?, 'pending')`,
        [noteRes.insertId, d.phoneNumber, d.contactName ?? null, followUp, user.id],
      );
    }

    // Daily performance rollup.
    const connected = d.status === 'connected' ? 1 : 0;
    await conn.execute(
      `INSERT INTO performance
         (employee_id, date, calls_made, calls_connected, total_duration_seconds)
       VALUES (?, CURDATE(), 1, ?, ?)
       ON DUPLICATE KEY UPDATE
         calls_made = calls_made + 1,
         calls_connected = calls_connected + VALUES(calls_connected),
         total_duration_seconds = total_duration_seconds + VALUES(total_duration_seconds)`,
      [user.id, connected, duration],
    );
    await conn.execute(
      `UPDATE performance
          SET success_rate = ROUND(100 * calls_connected / GREATEST(calls_made, 1), 2)
        WHERE employee_id = ? AND date = CURDATE()`,
      [user.id],
    );

    await conn.commit();
    broadcastChange('calls');
    return ok({ callId }, 201);
  } catch (err) {
    await conn.rollback();
    console.error('[calls] log failed:', err);
    return fail('Failed to save call', 500);
  } finally {
    conn.release();
  }
}

/** GET /api/employee/calls - the employee's 20 most recent calls. */
export async function GET() {
  const user = await authenticate(['employee']);
  if (isError(user)) return user;

  const calls = await query(
    `SELECT id, phone_number, contact_name, status, duration_seconds, created_at
       FROM calls
      WHERE employee_id = ?
      ORDER BY created_at DESC
      LIMIT 20`,
    [user.id],
  );
  return ok({ calls });
}

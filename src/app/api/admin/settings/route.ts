import { authenticate, isError, ok, fail } from '@/lib/api';
import { query } from '@/lib/db';
import { getSettings, updateSettings } from '@/lib/settings';

export const runtime = 'nodejs';

const KNOWN_KEYS = [
  'break_minutes_per_day',
  'max_breaks_per_day',
  'call_limit_per_day',
  'work_start',
  'work_end',
  'min_password_length',
  'recording_retention_days',
];

/** GET /api/admin/settings - all system settings. */
export async function GET() {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;
  return ok({ settings: await getSettings() });
}

/** PUT /api/admin/settings - update system settings. */
export async function PUT(req: Request) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail('Invalid settings payload');

  const updates: Record<string, string> = {};
  for (const key of KNOWN_KEYS) {
    if (body[key] !== undefined && body[key] !== null) {
      updates[key] = String(body[key]).slice(0, 255);
    }
  }
  if (Object.keys(updates).length === 0) return fail('No valid settings provided');

  await updateSettings(updates);
  await query(
    'INSERT INTO audit_logs (user_id, action, entity) VALUES (?,?,?)',
    [u.id, 'update_settings', 'settings'],
  );
  return ok({ ok: true });
}

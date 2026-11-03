import { authenticate, isError, ok, fail } from '@/lib/api';
import { logAudit } from '@/lib/audit';
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
  // Predictive dialer tunables (read live by predictive-engine.js).
  'predictive_ratio',
  'phone_cooldown_seconds',
  'dialer_claim_timeout_sec',
  'dialer_oncall_timeout_sec',
];

const TIME_KEYS = new Set(['work_start', 'work_end']);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

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
    if (body[key] === undefined || body[key] === null) continue;
    const value = String(body[key]).trim().slice(0, 255);
    // A cleared box means "leave it as it is". Storing '' would silently turn
    // a dialer tunable into 0, because the engine reads a blank as zero.
    if (value === '') continue;
    const label = key.replace(/_/g, ' ');
    if (TIME_KEYS.has(key)) {
      if (!TIME_RE.test(value)) return fail(`${label} must be a time (HH:MM)`);
    } else {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return fail(`${label} must be a number of 0 or more`);
    }
    updates[key] = value;
  }
  if (Object.keys(updates).length === 0) return fail('No valid settings provided');

  await updateSettings(updates);
  await logAudit({
    userId: u.id,
    action: 'update_settings',
    entity: 'settings',
    details: { keys: Object.keys(updates) },
  });
  return ok({ ok: true });
}

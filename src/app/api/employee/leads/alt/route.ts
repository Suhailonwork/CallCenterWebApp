import { authenticate, isError, ok, fail } from '@/lib/api';
import { query, queryOne } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/employee/leads/alt  { leadId, altNumber }
 *
 * Store (or clear) an alternative phone number the agent found for a lead. It
 * is kept on the record's custom_fields under a stable key so it shows up like
 * any other field next time the customer is pulled up — in the dialer or the
 * search box. Unscoped, to match the cross-campaign search.
 */

const ALT_FIELD = 'Alt Number';

/** Upsert the alt-number key, preserving the record's existing shape. */
function withAlt(raw: unknown, value: string): unknown {
  let parsed: unknown = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }

  // Array of [label, value] pairs — keep that shape.
  if (Array.isArray(parsed)) {
    const pairs = parsed.filter((p) => Array.isArray(p)) as unknown[][];
    const idx = pairs.findIndex(
      (p) => String(p[0]).trim().toLowerCase() === ALT_FIELD.toLowerCase(),
    );
    if (!value) {
      return idx >= 0 ? pairs.filter((_, i) => i !== idx) : pairs;
    }
    if (idx >= 0) pairs[idx] = [ALT_FIELD, value];
    else pairs.push([ALT_FIELD, value]);
    return pairs;
  }

  // Object (or empty) — plain key/value.
  const obj: Record<string, unknown> =
    parsed && typeof parsed === 'object' ? { ...(parsed as Record<string, unknown>) } : {};
  if (!value) {
    delete obj[ALT_FIELD];
    // also drop a differently-cased duplicate, if one slipped in
    for (const k of Object.keys(obj)) {
      if (k.trim().toLowerCase() === ALT_FIELD.toLowerCase()) delete obj[k];
    }
    return obj;
  }
  // overwrite any case variant so we don't end up with two alt keys
  for (const k of Object.keys(obj)) {
    if (k.trim().toLowerCase() === ALT_FIELD.toLowerCase() && k !== ALT_FIELD) delete obj[k];
  }
  obj[ALT_FIELD] = value;
  return obj;
}

export async function POST(req: Request) {
  const u = await authenticate(['employee']);
  if (isError(u)) return u;

  const body = await req.json().catch(() => null);
  const leadId = Number(body?.leadId);
  if (!Number.isInteger(leadId) || leadId <= 0) return fail('Invalid lead id');

  // Keep only sane phone characters; cap the length.
  const altNumber = String(body?.altNumber ?? '')
    .replace(/[^0-9+\-\s()]/g, '')
    .trim()
    .slice(0, 32);

  const lead = await queryOne<{ custom_fields: unknown }>(
    'SELECT custom_fields FROM csv_data WHERE id = ?',
    [leadId],
  );
  if (!lead) return fail('Contact not found', 404);

  const next = withAlt(lead.custom_fields, altNumber);
  await query('UPDATE csv_data SET custom_fields = ? WHERE id = ?', [
    JSON.stringify(next),
    leadId,
  ]);

  return ok({ altNumber, custom_fields: next });
}

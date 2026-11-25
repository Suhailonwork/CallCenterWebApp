import { authenticate, isError, ok, fail } from '@/lib/api';
import { query, queryOne } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/employee/leads/fields  { leadId, fields: { "REF - 1 NAME": "…" }, name? }
 *
 * Edit the record's data fields straight in the database — reference names,
 * contact numbers, anything on custom_fields — plus the contact's own name.
 * Merge semantics: only the keys sent are touched, so a separate save (e.g. the
 * alternative number) is never clobbered. Preserves the record's existing shape
 * (object vs [label, value] array). Unscoped, to match the cross-campaign search.
 */

/** Apply a {key: value} patch to custom_fields, keeping the stored shape. */
function patchFields(raw: unknown, patch: Record<string, string>): unknown {
  let parsed: unknown = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }

  const entries = Object.entries(patch);

  // Array of [label, value] pairs — update in place, append what's new.
  if (Array.isArray(parsed)) {
    const pairs = parsed.filter((p) => Array.isArray(p)).map((p) => [...p]) as unknown[][];
    for (const [key, value] of entries) {
      const idx = pairs.findIndex(
        (p) => String(p[0]).trim().toLowerCase() === key.trim().toLowerCase(),
      );
      if (idx >= 0) pairs[idx][1] = value;
      else pairs.push([key, value]);
    }
    return pairs;
  }

  // Object (or empty) — plain key/value, overwriting any case variant.
  const obj: Record<string, unknown> =
    parsed && typeof parsed === 'object' ? { ...(parsed as Record<string, unknown>) } : {};
  for (const [key, value] of entries) {
    for (const k of Object.keys(obj)) {
      if (k.trim().toLowerCase() === key.trim().toLowerCase() && k !== key) delete obj[k];
    }
    obj[key] = value;
  }
  return obj;
}

export async function POST(req: Request) {
  const u = await authenticate(['employee']);
  if (isError(u)) return u;

  const body = await req.json().catch(() => null);
  const leadId = Number(body?.leadId);
  if (!Number.isInteger(leadId) || leadId <= 0) return fail('Invalid lead id');

  // Sanitise the patch: string keys/values only, trimmed, length-capped.
  const patch: Record<string, string> = {};
  const rawFields = body?.fields;
  if (rawFields && typeof rawFields === 'object' && !Array.isArray(rawFields)) {
    for (const [k, v] of Object.entries(rawFields as Record<string, unknown>)) {
      const key = String(k).trim().slice(0, 100);
      if (!key) continue;
      patch[key] = String(v ?? '').trim().slice(0, 500);
    }
  }

  // The contact's own name can be edited too (optional).
  const hasName = typeof body?.name === 'string';
  const name = hasName ? String(body.name).trim().slice(0, 150) : null;

  if (Object.keys(patch).length === 0 && !hasName) {
    return fail('Nothing to update');
  }

  const lead = await queryOne<{ custom_fields: unknown }>(
    'SELECT custom_fields FROM csv_data WHERE id = ?',
    [leadId],
  );
  if (!lead) return fail('Contact not found', 404);

  const nextFields = patchFields(lead.custom_fields, patch);

  if (hasName) {
    await query('UPDATE csv_data SET custom_fields = ?, name = ? WHERE id = ?', [
      JSON.stringify(nextFields),
      name || null,
      leadId,
    ]);
  } else {
    await query('UPDATE csv_data SET custom_fields = ? WHERE id = ?', [
      JSON.stringify(nextFields),
      leadId,
    ]);
  }

  return ok({ custom_fields: nextFields, name: hasName ? name : undefined });
}

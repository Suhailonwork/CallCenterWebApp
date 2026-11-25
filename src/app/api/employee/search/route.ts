import { authenticate, isError, ok } from '@/lib/api';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/employee/search?q=…
 *
 * A single lookup box for the agent: match a phone number, a customer name, or
 * any field on the record (loan number lives inside custom_fields) and return
 * the full customer detail — across EVERY campaign and group, not just the
 * agent's own, and including numbers that only appear in the call history.
 *
 * Deliberately unscoped: the agent needs to pull up a customer the moment they
 * call in, whichever campaign the data was loaded under.
 */

interface SearchResult {
  id: number | null; // csv_data.id when this is a live lead, else null
  phone: string;
  name: string | null;
  email: string | null;
  company: string | null;
  campaign: string | null;
  list: string | null;
  status: string | null;
  fields: [string, string][];
  calls: number;
  last_call_at: string | null;
  in_data: boolean;
}

/** custom_fields may be a JSON object or an array of [label, value] pairs. */
function fieldEntries(raw: unknown): [string, string][] {
  let parsed: unknown = raw;
  if (!parsed) return [];
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  let pairs: [string, unknown][] = [];
  if (Array.isArray(parsed)) {
    pairs = parsed
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map((p) => [String((p as unknown[])[0]), (p as unknown[])[1]] as [string, unknown]);
  } else if (parsed && typeof parsed === 'object') {
    pairs = Object.entries(parsed as Record<string, unknown>);
  }
  return pairs
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) => [k, String(v)] as [string, string]);
}

export async function GET(req: Request) {
  const u = await authenticate(['employee']);
  if (isError(u)) return u;

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
  if (q.length < 2) return ok({ results: [], query: q });

  const like = `%${q}%`;

  // 1) Live leads — the full record, so loan / name / phone all resolve here.
  const leads = await query<{
    id: number;
    phone_number: string;
    name: string | null;
    email: string | null;
    company: string | null;
    custom_fields: unknown;
    call_status: string | null;
    last_call_at: string | null;
    campaign: string | null;
    list: string | null;
  }>(
    `SELECT d.id, d.phone_number, d.name, d.email, d.company, d.custom_fields,
            d.call_status,
            DATE_FORMAT(d.last_call_at, '%Y-%m-%d %H:%i:%s') AS last_call_at,
            cmp.name AS campaign, l.name AS list
       FROM csv_data d
       LEFT JOIN campaigns cmp ON cmp.id = d.campaign_id
       LEFT JOIN lists l       ON l.id = d.list_id
      WHERE d.phone_number LIKE ? OR d.name LIKE ? OR d.custom_fields LIKE ?
      ORDER BY (d.last_call_at IS NULL), d.last_call_at DESC, d.id DESC
      LIMIT 40`,
    [like, like, like],
  );

  const results: SearchResult[] = [];
  const seen = new Set<string>();

  for (const d of leads) {
    const phone = d.phone_number;
    if (seen.has(phone)) continue; // keep the first (most recently called) record per number
    seen.add(phone);
    results.push({
      id: d.id,
      phone,
      name: d.name,
      email: d.email,
      company: d.company,
      campaign: d.campaign,
      list: d.list,
      status: d.call_status,
      fields: fieldEntries(d.custom_fields),
      calls: 0,
      last_call_at: d.last_call_at,
      in_data: true,
    });
  }

  // 2) Numbers that only live in the call history — still searchable, so a
  //    customer whose lead was purged can be pulled up and called back.
  const hist = await query<{
    phone_number: string;
    name: string | null;
    total: number;
    last_at: string | null;
  }>(
    `SELECT c.phone_number,
            MAX(c.contact_name) AS name,
            COUNT(*) AS total,
            DATE_FORMAT(MAX(c.created_at), '%Y-%m-%d %H:%i:%s') AS last_at
       FROM calls c
      WHERE c.phone_number LIKE ? OR c.contact_name LIKE ?
      GROUP BY c.phone_number
      ORDER BY last_at DESC
      LIMIT 40`,
    [like, like],
  );

  const histByPhone = new Map(hist.map((h) => [h.phone_number, h]));

  // Fold the call totals into the lead cards…
  for (const r of results) {
    const h = histByPhone.get(r.phone);
    if (h) r.calls = Number(h.total) || 0;
  }

  // …and add the history-only numbers as their own (lighter) cards.
  for (const h of hist) {
    if (seen.has(h.phone_number)) continue;
    seen.add(h.phone_number);
    results.push({
      id: null,
      phone: h.phone_number,
      name: h.name,
      email: null,
      company: null,
      campaign: null,
      list: null,
      status: null,
      fields: [],
      calls: Number(h.total) || 0,
      last_call_at: h.last_at,
      in_data: false,
    });
  }

  return ok({ results, query: q });
}

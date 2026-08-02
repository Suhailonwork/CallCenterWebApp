import { z } from 'zod';
import type { PoolConnection } from 'mysql2/promise';
import { pool, query, queryOne } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { parseCsv, mapColumns } from '@/lib/csv';
import {
  composeListFields,
  customFieldColumns,
  normFieldName,
} from '@/lib/listFields';

/** Up to 200 field names, trimmed & non-empty, ≤120 chars each (defaults + custom). */
export const fieldsSchema = z.array(z.string().trim().min(1).max(120)).max(200);

/**
 * Canonical `lists.fields` for storage: always the 24 mandatory defaults
 * first, then the caller's de-duplicated custom fields. Tolerates mysql2's
 * already-parsed JSON / string form. Never returns null — every list carries
 * at least the defaults.
 */
export function normalizeFields(raw: unknown): string[] {
  let arr: unknown = raw;
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr);
    } catch {
      arr = null;
    }
  }
  return composeListFields(Array.isArray(arr) ? (arr as string[]) : null);
}

/** A lists row joined with its campaign (the shape routes pass around). */
export interface ListRecord {
  id: number;
  name: string;
  description: string | null;
  campaign_id: number;
  campaign_name: string;
  group_id: number | null;
  active: 'Y' | 'N';
  /** Always the 24 defaults first, then custom fields. */
  fields: string[];
}

export async function getList(listId: number): Promise<ListRecord | null> {
  const row = await queryOne<Omit<ListRecord, 'fields'> & { fields: unknown }>(
    `SELECT l.id, l.name, l.description, l.campaign_id, c.name AS campaign_name,
            c.group_id, l.active, l.fields
       FROM lists l
       JOIN campaigns c ON c.id = l.campaign_id
      WHERE l.id = ?`,
    [listId],
  );
  if (!row) return null;
  return { ...row, fields: normalizeFields(row.fields) };
}

/** JSON of the mandatory default field layout — every new list starts here. */
export const DEFAULT_FIELDS_JSON = JSON.stringify(composeListFields([]));

/**
 * Compat shim for the legacy per-campaign upload endpoints: resolve the
 * campaign's first list, creating an ACTIVE "Default List" (with the mandatory
 * default fields) when the campaign has none.
 */
export async function ensureDefaultList(campaignId: number): Promise<number | null> {
  // Prefer an ACTIVE list so legacy uploads stay dialable even when the
  // campaign's oldest list has been switched OFF.
  const pick = () =>
    queryOne<{ id: number }>(
      "SELECT id FROM lists WHERE campaign_id = ? ORDER BY (active = 'Y') DESC, id ASC LIMIT 1",
      [campaignId],
    );
  const existing = await pick();
  if (existing) return existing.id;
  const campaign = await queryOne<{ id: number }>('SELECT id FROM campaigns WHERE id = ?', [campaignId]);
  if (!campaign) return null;
  // Atomic create: two concurrent uploads to a list-less campaign must not
  // each create their own 'Default List' (unique key on (campaign_id, name)).
  const [res]: any = await pool.execute(
    `INSERT INTO lists (name, description, campaign_id, active, fields)
     SELECT 'Default List', 'Auto-created for a legacy campaign upload', ?, 'Y', ?
       FROM DUAL
      WHERE NOT EXISTS (SELECT 1 FROM lists WHERE campaign_id = ?)`,
    [campaignId, DEFAULT_FIELDS_JSON, campaignId],
  );
  if (res.affectedRows > 0) return res.insertId as number;
  const winner = await pick();
  return winner?.id ?? null;
}

export type DupMode = 'none' | 'list' | 'campaign';

export interface ImportResult {
  imported: number;
  skippedDuplicates: number;
  totalRows: number;
  /** CSV headers that matched no list field (their data was NOT imported). */
  ignoredColumns: string[];
}

export type ImportError = { error: string };

/**
 * Import a CSV into a list.
 *
 * Field handling — the list's schema (lists.fields) is FIXED here and is
 * NEVER changed by an upload (custom fields are added only by an admin on the
 * Modify List page):
 *  - CSV headers are matched to the list's fields case-insensitively, ignoring
 *    spaces / `_` / `-` (normFieldName): "Ref - No" ≡ "ref_no" ≡ "REFNO";
 *  - "Customer Name" / "Mobile No" are DEDICATED → their values go to the
 *    csv_data.name / phone_number columns, never custom_fields;
 *  - every other list field's value is stored, in list order, as an ordered
 *    [field, value] pair in csv_data.custom_fields (empty values skipped);
 *  - CSV columns that match NO list field are IGNORED and reported back in
 *    result.ignoredColumns.
 *
 * dupMode:
 *   'none'     — append everything;
 *   'list'     — skip phones already in THIS list (and in-file repeats);
 *   'campaign' — skip phones in ANY list of the list's campaign.
 */
export async function importCsvIntoList(
  list: ListRecord,
  csvText: string,
  dupMode: DupMode,
  userId: number,
): Promise<ImportResult | ImportError> {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return { error: 'CSV must have a header row and at least one row' };

  const header = rows[0];
  const cols = mapColumns(header);
  if (cols.phone < 0) {
    return { error: 'CSV must contain a phone column ("Mobile No", "phone", "phone_number", …)' };
  }

  // Match CSV headers to list fields by normFieldName (case-insensitive,
  // ignoring spaces/_/-). headerIndex: match key -> CSV column index.
  const headerIndex = new Map<string, number>();
  header.forEach((h, i) => {
    const k = normFieldName(h);
    if (k && !headerIndex.has(k)) headerIndex.set(k, i);
  });

  // Columns stored in custom_fields: every list field except the dedicated
  // ones (Customer Name / Mobile No), in the list's order.
  const customCols = customFieldColumns(list.fields);

  // Columns whose values already have a home (dedicated name/phone + any
  // email/company the CSV carried) — never "ignored".
  const homedIdx = new Set(
    [cols.phone, cols.name, cols.email, cols.company].filter((i) => i >= 0),
  );
  const listFieldKeys = new Set(list.fields.map(normFieldName));
  const ignoredColumns: string[] = [];
  header.forEach((h, i) => {
    if (homedIdx.has(i)) return;
    const name = h.trim();
    if (!name) return;
    if (listFieldKeys.has(normFieldName(name))) return; // matched a list field
    ignoredColumns.push(name);
  });

  const contacts = rows
    .slice(1)
    .map((r) => {
      // Only fields that exist in this list; value pulled from the matching
      // CSV column (skip empties). lists.fields is never modified.
      const customFields: [string, string][] = [];
      for (const field of customCols) {
        const idx = headerIndex.get(normFieldName(field));
        if (idx === undefined) continue;
        const val = (r[idx] ?? '').trim();
        if (val !== '') customFields.push([field, val]);
      }
      return {
        phone: (r[cols.phone] ?? '').trim().slice(0, 32),
        name: cols.name >= 0 ? (r[cols.name] ?? '').trim() || null : null,
        email: cols.email >= 0 ? (r[cols.email] ?? '').trim() || null : null,
        company: cols.company >= 0 ? (r[cols.company] ?? '').trim() || null : null,
        customFields: customFields.length > 0 ? JSON.stringify(customFields) : null,
      };
    })
    .filter((c) => c.phone.length > 0);

  if (contacts.length === 0) return { error: 'No valid phone numbers found in the file' };

  // Duplicate gate: existing phones in scope + first-occurrence-wins in-file.
  const seen = new Set<string>();
  if (dupMode !== 'none') {
    const existing =
      dupMode === 'list'
        ? await query<{ phone_number: string }>(
            'SELECT DISTINCT phone_number FROM csv_data WHERE list_id = ?',
            [list.id],
          )
        : await query<{ phone_number: string }>(
            'SELECT DISTINCT phone_number FROM csv_data WHERE campaign_id = ?',
            [list.campaign_id],
          );
    for (const e of existing) seen.add(e.phone_number);
  }

  let skippedDuplicates = 0;
  const toInsert = contacts.filter((c) => {
    if (dupMode === 'none') return true;
    if (seen.has(c.phone)) {
      skippedDuplicates++;
      return false;
    }
    seen.add(c.phone);
    return true;
  });

  const conn: PoolConnection = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Re-read (and lock) the list's campaign inside the transaction: a
    // concurrent "move list to another campaign" (PATCH re-home) must not
    // leave these rows stamped with the OLD campaign_id — that would strand
    // them outside every claim query.
    const [lockRows]: any = await conn.execute(
      'SELECT campaign_id FROM lists WHERE id = ? FOR UPDATE',
      [list.id],
    );
    if (!lockRows[0]) {
      await conn.rollback();
      return { error: 'List no longer exists' };
    }
    const campaignId: number = lockRows[0].campaign_id;

    // NOTE: lists.fields is intentionally NOT modified by an upload — the list
    // schema is admin-controlled (Modify List page). Unmatched CSV columns are
    // reported in ignoredColumns, not added.
    for (const c of toInsert) {
      await conn.execute(
        `INSERT INTO csv_data (campaign_id, list_id, phone_number, name, email, company, custom_fields)
         VALUES (?,?,?,?,?,?,?)`,
        [campaignId, list.id, c.phone, c.name, c.email, c.company, c.customFields],
      );
    }
    await logAudit(
      {
        userId,
        action: 'upload_contacts',
        entity: 'lists',
        entityId: list.id,
        details: {
          campaignId,
          imported: toInsert.length,
          skippedDuplicates,
          dupMode,
          ignoredColumns,
        },
      },
      conn,
    );
    await conn.commit();
    return {
      imported: toInsert.length,
      skippedDuplicates,
      totalRows: contacts.length,
      ignoredColumns,
    };
  } catch (e) {
    await conn.rollback();
    console.error('[lists] CSV import failed:', e);
    return { error: 'Failed to import contacts' };
  } finally {
    conn.release();
  }
}

export function parseDupMode(raw: unknown): DupMode {
  return raw === 'list' || raw === 'campaign' ? raw : 'none';
}

// ---- Campaign dial-rule schemas (shared by the campaign create/update routes) ----

export const dialStatusesSchema = z.array(z.string().trim().min(1).max(32)).max(20);

export const recycleRulesSchema = z
  .array(
    z.object({
      status: z.string().trim().min(1).max(32),
      delay_min: z.number().int().min(1).max(10080), // up to 7 days
      max_attempts: z.number().int().min(1).max(50),
    }),
  )
  .max(20);

/** HH:MM or HH:MM:SS — the calling-window bounds. */
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Use HH:MM')
  .nullable();

/**
 * Pacing / retry knobs that live on the campaign row. Every field is optional
 * so a PATCH can send just the one it changes.
 */
export const pacingFields = {
  /** Lines opened per READY agent. 1.00 = progressive (no abandons). */
  dial_ratio: z.number().min(1).max(10),
  /** Max total dial attempts per lead; 0 = unlimited (recycle rules decide). */
  retry_count: z.number().int().min(0).max(100),
  /** Fallback retry delay for a recycle rule that omits delay_min. */
  retry_delay_minutes: z.number().int().min(1).max(10080),
  /** Seconds the customer's phone may ring before the attempt is abandoned. */
  dial_timeout_sec: z.number().int().min(10).max(180),
  /** Breather after a call before the engine opens a new line for the agent. */
  wrapup_seconds: z.number().int().min(0).max(600),
  lead_order: z.enum(['oldest', 'newest', 'priority', 'random']),
  callbacks_enabled: z.boolean(),
  max_abandon_pct: z.number().min(0).max(100),
  recording_enabled: z.boolean(),
  calling_start: timeSchema,
  calling_end: timeSchema,
} as const;

export const pacingSchema = z.object({
  dial_ratio: pacingFields.dial_ratio.optional(),
  retry_count: pacingFields.retry_count.optional(),
  retry_delay_minutes: pacingFields.retry_delay_minutes.optional(),
  dial_timeout_sec: pacingFields.dial_timeout_sec.optional(),
  wrapup_seconds: pacingFields.wrapup_seconds.optional(),
  lead_order: pacingFields.lead_order.optional(),
  callbacks_enabled: pacingFields.callbacks_enabled.optional(),
  max_abandon_pct: pacingFields.max_abandon_pct.optional(),
  recording_enabled: pacingFields.recording_enabled.optional(),
  calling_start: pacingFields.calling_start.optional(),
  calling_end: pacingFields.calling_end.optional(),
});

export type PacingInput = z.infer<typeof pacingSchema>;

/**
 * Write whichever pacing fields the request actually sent, in one UPDATE.
 * Returns the number of columns changed (0 = nothing to do).
 */
export async function applyCampaignPacing(
  conn: PoolConnection,
  campaignId: number,
  d: PacingInput,
): Promise<number> {
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  const push = (col: string, val: string | number | null) => {
    sets.push(`${col} = ?`);
    vals.push(val);
  };

  if (d.dial_ratio !== undefined) push('dial_ratio', d.dial_ratio);
  if (d.retry_count !== undefined) push('retry_count', d.retry_count);
  if (d.retry_delay_minutes !== undefined) push('retry_delay_minutes', d.retry_delay_minutes);
  if (d.dial_timeout_sec !== undefined) push('dial_timeout_sec', d.dial_timeout_sec);
  if (d.wrapup_seconds !== undefined) push('wrapup_seconds', d.wrapup_seconds);
  if (d.lead_order !== undefined) push('lead_order', d.lead_order);
  if (d.callbacks_enabled !== undefined) push('callbacks_enabled', d.callbacks_enabled ? 1 : 0);
  if (d.max_abandon_pct !== undefined) push('max_abandon_pct', d.max_abandon_pct);
  if (d.recording_enabled !== undefined) push('recording_enabled', d.recording_enabled ? 1 : 0);
  if (d.calling_start !== undefined) push('calling_start', d.calling_start);
  if (d.calling_end !== undefined) push('calling_end', d.calling_end);

  if (sets.length === 0) return 0;
  vals.push(campaignId);
  await conn.execute(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = ?`, vals);
  return sets.length;
}

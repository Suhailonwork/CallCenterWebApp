import { z } from 'zod';
import type { PoolConnection } from 'mysql2/promise';
import { pool, query, queryOne } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { parseCsv, mapColumns, buildCustomFields, buildCustomFieldsForTable } from '@/lib/csv';
import { dataTableColumnsForList } from '@/lib/dataTables';

/** Up to 100 custom field names, trimmed & non-empty, ≤120 chars each. */
export const fieldsSchema = z.array(z.string().trim().min(1).max(120)).max(100);

/**
 * Sanitize an incoming `fields` value into a clean ordered array (dedupe
 * case-insensitively, drop blanks) or null when the list should store every
 * CSV column. Also tolerates mysql2's already-parsed JSON / string form.
 */
export function normalizeFields(raw: unknown): string[] | null {
  let arr: unknown = raw;
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(arr)) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const s = String(v ?? '').trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out.length > 0 ? out : null;
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
  fields: string[] | null;
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

/**
 * Compat shim for the legacy per-campaign upload endpoints: resolve the
 * campaign's first list, creating an ACTIVE "Default List" (fields = NULL,
 * i.e. store every CSV column) when the campaign has none.
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
     SELECT 'Default List', 'Auto-created for a legacy campaign upload', ?, 'Y', NULL
       FROM DUAL
      WHERE NOT EXISTS (SELECT 1 FROM lists WHERE campaign_id = ?)`,
    [campaignId, campaignId],
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
}

export type ImportError = { error: string };

/**
 * Import a CSV into a list. Template logic is unchanged from the campaign
 * era — it is just resolved from the LIST's template now: with a template,
 * custom_fields is the ordered [col,value] array of the template's columns;
 * without, the legacy "store every extra column" object.
 *
 * dupMode:
 *   'none'     — append everything (legacy behavior);
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
    return { error: 'CSV must contain a phone column ("phone", "mobile no", "phone_number", …)' };
  }

  const tableColumns = await dataTableColumnsForList(list.id);

  const contacts = rows
    .slice(1)
    .map((r) => {
      // Table path → ordered array of [col,value] pairs; legacy path → object.
      const customFields = tableColumns
        ? buildCustomFieldsForTable(header, r, tableColumns)
        : buildCustomFields(header, r, cols);
      const hasFields = Array.isArray(customFields)
        ? customFields.length > 0
        : Object.keys(customFields).length > 0;
      return {
        phone: (r[cols.phone] ?? '').trim().slice(0, 32),
        name: cols.name >= 0 ? (r[cols.name] ?? '').trim() || null : null,
        email: cols.email >= 0 ? (r[cols.email] ?? '').trim() || null : null,
        company: cols.company >= 0 ? (r[cols.company] ?? '').trim() || null : null,
        customFields: hasFields ? JSON.stringify(customFields) : null,
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
        },
      },
      conn,
    );
    await conn.commit();
    return { imported: toInsert.length, skippedDuplicates, totalRows: contacts.length };
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

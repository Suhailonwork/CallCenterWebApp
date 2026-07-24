import { queryOne } from '@/lib/db';

/**
 * Resolve the ordered column list for a campaign's selected Data Table, or null
 * if the campaign has none (or the table was removed). Falls back to null on any
 * error (e.g. the data_table_id column not migrated yet) so CSV uploads keep
 * working with the legacy "store all extra columns" behavior.
 */
export async function dataTableColumnsForCampaign(campaignId: number): Promise<string[] | null> {
  try {
    const row = await queryOne<{ columns: unknown }>(
      `SELECT dt.columns AS columns
         FROM campaigns c
         JOIN data_tables dt ON dt.id = c.data_table_id
        WHERE c.id = ?`,
      [campaignId],
    );
    return normalizeColumns(row?.columns);
  } catch {
    return null;
  }
}

/**
 * Resolve the ordered column list for a LIST's Data Template (lists.template_id),
 * or null if the list has none — same null-fallback contract as the campaign
 * variant above. Uploads are list-scoped, so this is the resolver the upload
 * flow uses; the campaign variant remains for legacy callers.
 */
export async function dataTableColumnsForList(listId: number): Promise<string[] | null> {
  try {
    const row = await queryOne<{ columns: unknown }>(
      `SELECT dt.columns AS columns
         FROM lists l
         JOIN data_tables dt ON dt.id = l.template_id
        WHERE l.id = ?`,
      [listId],
    );
    return normalizeColumns(row?.columns);
  } catch {
    return null;
  }
}

function normalizeColumns(raw: unknown): string[] | null {
  if (raw == null) return null;
  // mysql2 returns JSON columns already parsed; guard against string form too.
  const cols = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (Array.isArray(cols) && cols.length > 0) return cols.map((c) => String(c));
  return null;
}

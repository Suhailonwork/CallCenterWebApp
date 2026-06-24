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
    if (!row) return null;
    // mysql2 returns JSON columns already parsed; guard against string form too.
    const cols = typeof row.columns === 'string' ? JSON.parse(row.columns) : row.columns;
    if (Array.isArray(cols) && cols.length > 0) return cols.map((c) => String(c));
    return null;
  } catch {
    return null;
  }
}

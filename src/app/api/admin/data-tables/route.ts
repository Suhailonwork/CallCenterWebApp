import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import type { ResultSetHeader } from 'mysql2';

export const runtime = 'nodejs';

/** GET /api/admin/data-tables — list all data tables (TL: read-only, for campaign setup) */
export async function GET() {
  const u = await authenticate(['admin', 'tl']);
  if (isError(u)) return u;

  try {
    const [rows] = await pool.execute(
      `SELECT id, name, columns, created_by, created_at
         FROM data_tables
        ORDER BY name ASC`,
    );
    return ok({ dataTables: rows });
  } catch (e: any) {
    // Table may not exist yet — return empty list with a hint instead of crashing
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[data-tables] data_tables table missing — run: npm run db:migrate:data-tables');
      return ok({ dataTables: [], _hint: 'Run npm run db:migrate:data-tables first' });
    }
    console.error('[data-tables GET]', e);
    return fail('Failed to load data tables', 500);
  }
}

const createSchema = z.object({
  name:    z.string().min(1).max(120),
  columns: z.array(z.string().trim().min(1).max(120)).min(1).max(100),
});

/** POST /api/admin/data-tables — create a data table */
export async function POST(req: Request) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid data table — provide a name and at least one column');
  const d = parsed.data;

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO data_tables (name, columns, created_by)
       VALUES (?, ?, ?)`,
      [d.name, JSON.stringify(d.columns), u.id],
    );
    const newId = result.insertId;

    await logAudit({
      userId: u.id,
      action: 'create_data_table',
      entity: 'data_tables',
      entityId: newId,
      details: { name: d.name, columns: d.columns },
    });

    return ok({ id: newId }, 201);
  } catch (e: any) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      return fail('Database not migrated — run npm run db:migrate:data-tables first', 503);
    }
    console.error('[data-tables POST]', e);
    return fail('Failed to create data table', 500);
  }
}

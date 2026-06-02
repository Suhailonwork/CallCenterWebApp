import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool } from '@/lib/db';
import { parseCsv, mapColumns } from '@/lib/csv';

export const runtime = 'nodejs';

/** POST /api/admin/campaigns/:id/contacts - upload a CSV of contacts. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const campaignId = Number(params.id);
  if (!Number.isInteger(campaignId)) return fail('Invalid campaign id');

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return fail('No CSV file uploaded');
  if (file.size > 5 * 1024 * 1024) return fail('File too large (max 5 MB)');

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return fail('CSV must have a header row and at least one row');

  const cols = mapColumns(rows[0]);
  if (cols.phone < 0) {
    return fail('CSV must contain a "phone" (or "phone_number") column');
  }

  const contacts = rows
    .slice(1)
    .map((r) => ({
      phone: (r[cols.phone] ?? '').trim().slice(0, 32),
      name: cols.name >= 0 ? (r[cols.name] ?? '').trim() || null : null,
      email: cols.email >= 0 ? (r[cols.email] ?? '').trim() || null : null,
      company: cols.company >= 0 ? (r[cols.company] ?? '').trim() || null : null,
    }))
    .filter((c) => c.phone.length > 0);

  if (contacts.length === 0) return fail('No valid phone numbers found in the file');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const c of contacts) {
      await conn.execute(
        `INSERT INTO csv_data (campaign_id, phone_number, name, email, company)
         VALUES (?,?,?,?,?)`,
        [campaignId, c.phone, c.name, c.email, c.company],
      );
    }
    await conn.execute(
      'INSERT INTO audit_logs (user_id, action, entity, entity_id) VALUES (?,?,?,?)',
      [u.id, 'upload_contacts', 'campaigns', campaignId],
    );
    await conn.commit();
    return ok({ imported: contacts.length }, 201);
  } catch (e) {
    await conn.rollback();
    console.error('[campaigns/contacts] upload failed:', e);
    return fail('Failed to import contacts', 500);
  } finally {
    conn.release();
  }
}

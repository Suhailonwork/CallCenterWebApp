import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { parseCsv, mapColumns, buildCustomFields, buildCustomFieldsForTable } from '@/lib/csv';
import { dataTableColumnsForCampaign } from '@/lib/dataTables';
import { tlOwnsCampaign } from '@/lib/groups';

export const runtime = 'nodejs';

/**
 * POST /api/tl/campaigns/:id/contacts - upload a CSV of contacts for a
 * campaign in the TL's groups. Mirrors the admin upload endpoint.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['tl']);
  if (isError(u)) return u;

  const campaignId = Number(params.id);
  if (!Number.isInteger(campaignId)) return fail('Invalid campaign id');

  // RBAC: the campaign must belong to one of this TL's groups.
  if (!(await tlOwnsCampaign(u.id, campaignId))) {
    return fail('Campaign is not in your group', 403);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return fail('No CSV file uploaded');
  if (file.size > 5 * 1024 * 1024) return fail('File too large (max 5 MB)');

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return fail('CSV must have a header row and at least one row');

  const header = rows[0];
  const cols = mapColumns(header);
  if (cols.phone < 0) {
    return fail('CSV must contain a "phone" (or "phone_number") column');
  }

  // If the campaign has a Data Table, store only its columns (in order);
  // otherwise keep the legacy behavior of storing every extra column.
  const tableColumns = await dataTableColumnsForCampaign(campaignId);

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

  if (contacts.length === 0) return fail('No valid phone numbers found in the file');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const c of contacts) {
      await conn.execute(
        `INSERT INTO csv_data (campaign_id, phone_number, name, email, company, custom_fields)
         VALUES (?,?,?,?,?,?)`,
        [campaignId, c.phone, c.name, c.email, c.company, c.customFields],
      );
    }
    await logAudit(
      {
        userId: u.id,
        action: 'upload_contacts',
        entity: 'campaigns',
        entityId: campaignId,
        details: { imported: contacts.length, by: 'tl' },
      },
      conn,
    );
    await conn.commit();
    return ok({ imported: contacts.length }, 201);
  } catch (e) {
    await conn.rollback();
    console.error('[tl/campaigns/contacts] upload failed:', e);
    return fail('Failed to import contacts', 500);
  } finally {
    conn.release();
  }
}

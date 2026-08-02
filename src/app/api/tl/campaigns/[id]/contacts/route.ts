import { authenticate, isError, ok, fail } from '@/lib/api';
import { ensureDefaultList, getList, importCsvIntoList, parseDupMode } from '@/lib/lists';
import { tlOwnsCampaign } from '@/lib/groups';

export const runtime = 'nodejs';

/**
 * POST /api/tl/campaigns/:id/contacts — LEGACY upload endpoint (TL mirror).
 * Uploads now target a LIST (see /api/tl/lists/:id/contacts); this shim
 * imports into the campaign's first list, creating an active "Default List"
 * when the campaign has none.
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
  const dupMode = parseDupMode(form?.get('dupMode'));

  const listId = await ensureDefaultList(campaignId);
  if (listId == null) return fail('Campaign not found', 404);
  const list = await getList(listId);
  if (!list) return fail('List not found', 404);

  const result = await importCsvIntoList(list, await file.text(), dupMode, u.id);
  if ('error' in result) return fail(result.error, 400);
  return ok(result, 201);
}

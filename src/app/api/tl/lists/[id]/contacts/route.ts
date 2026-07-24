import { authenticate, isError, ok, fail } from '@/lib/api';
import { getList, importCsvIntoList, parseDupMode } from '@/lib/lists';
import { tlOwnsCampaign } from '@/lib/groups';

export const runtime = 'nodejs';

/**
 * POST /api/tl/lists/:id/contacts — TL mirror of the admin list upload;
 * the list's campaign must belong to one of the TL's groups.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['tl']);
  if (isError(u)) return u;

  const listId = Number(params.id);
  if (!Number.isInteger(listId) || listId <= 0) return fail('Invalid list id');
  const list = await getList(listId);
  if (!list) return fail('List not found', 404);
  if (!(await tlOwnsCampaign(u.id, list.campaign_id))) {
    return fail('Campaign is not in your group', 403);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return fail('No CSV file uploaded');
  if (file.size > 5 * 1024 * 1024) return fail('File too large (max 5 MB)');
  const dupMode = parseDupMode(form?.get('dupMode'));

  const result = await importCsvIntoList(list, await file.text(), dupMode, u.id);
  if ('error' in result) return fail(result.error, 400);
  return ok(result, 201);
}

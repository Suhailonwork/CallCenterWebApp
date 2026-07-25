import { authenticate, isError, ok, fail } from '@/lib/api';
import { getList, importCsvIntoList, parseDupMode } from '@/lib/lists';

export const runtime = 'nodejs';

/**
 * POST /api/admin/lists/:id/contacts — upload a CSV of leads into a list.
 * FormData: file (CSV, max 5 MB), dupMode = none | list | campaign.
 * The list's custom fields (lists.fields) decide which columns are stored.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const listId = Number(params.id);
  if (!Number.isInteger(listId) || listId <= 0) return fail('Invalid list id');
  const list = await getList(listId);
  if (!list) return fail('List not found', 404);

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return fail('No CSV file uploaded');
  if (file.size > 5 * 1024 * 1024) return fail('File too large (max 5 MB)');
  const dupMode = parseDupMode(form?.get('dupMode'));

  const result = await importCsvIntoList(list, await file.text(), dupMode, u.id);
  if ('error' in result) return fail(result.error, 400);
  return ok(result, 201);
}

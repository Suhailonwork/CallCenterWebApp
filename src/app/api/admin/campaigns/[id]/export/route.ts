import { authenticate, isError, fail } from '@/lib/api';
import { campaignExportResponse } from '@/lib/campaignExport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/campaigns/:id/export — uploaded data + call results, one row per lead. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail('Invalid campaign id');

  return campaignExportResponse(id, u.id);
}

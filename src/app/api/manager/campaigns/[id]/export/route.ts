import { authenticate, isError, fail } from '@/lib/api';
import { campaignExportResponse } from '@/lib/campaignExport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/manager/campaigns/:id/export — the admin export, for a manager. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['manager']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail('Invalid campaign id');

  return campaignExportResponse(id, u.id);
}

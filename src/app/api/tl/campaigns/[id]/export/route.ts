import { authenticate, isError, fail } from '@/lib/api';
import { tlOwnsCampaign } from '@/lib/groups';
import { campaignExportResponse } from '@/lib/campaignExport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/tl/campaigns/:id/export — the admin export, for a campaign in the TL's groups. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['tl']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail('Invalid campaign id');

  // RBAC: the campaign must belong to one of this TL's groups.
  if (!(await tlOwnsCampaign(u.id, id))) {
    return fail('Campaign is not in your group', 403);
  }

  return campaignExportResponse(id, u.id);
}

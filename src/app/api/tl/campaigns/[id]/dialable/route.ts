import { authenticate, isError, ok, fail } from '@/lib/api';
import { tlOwnsCampaign } from '@/lib/groups';
import { dialableReport } from '@/lib/dialerDiag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/tl/campaigns/:id/dialable — group-scoped mirror of the admin route. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['tl']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail('Invalid campaign id');
  if (!(await tlOwnsCampaign(u.id, id))) return fail('Campaign is not in your group', 403);

  const report = await dialableReport(id);
  if (!report) return fail('Campaign not found', 404);
  return ok(report);
}

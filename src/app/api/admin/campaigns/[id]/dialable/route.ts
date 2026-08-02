import { authenticate, isError, ok, fail } from '@/lib/api';
import { dialableReport } from '@/lib/dialerDiag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/campaigns/:id/dialable
 * "How many leads can the dialer claim right now, and what is stopping the
 * rest?" — computed with the engine's own predicate.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail('Invalid campaign id');

  const report = await dialableReport(id);
  if (!report) return fail('Campaign not found', 404);
  return ok(report);
}

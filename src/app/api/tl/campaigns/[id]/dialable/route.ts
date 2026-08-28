import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { tlOwnsCampaign } from '@/lib/groups';
import { dialStatusesSchema, recycleRulesSchema, dispositionRulesSchema } from '@/lib/lists';
import { dialableReport } from '@/lib/dialerDiag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const previewSchema = z.object({
  dial_statuses: dialStatusesSchema.optional(),
  recycle_rules: recycleRulesSchema.optional(),
  disposition_rules: dispositionRulesSchema.nullable().optional(),
  retry_count: z.number().int().min(0).max(100).optional(),
});

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

/** POST — same answer for dial rules the TL has selected but not yet saved. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['tl']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail('Invalid campaign id');
  if (!(await tlOwnsCampaign(u.id, id))) return fail('Campaign is not in your group', 403);

  const parsed = previewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid data');

  const report = await dialableReport(id, {
    dialStatuses: parsed.data.dial_statuses,
    recycleRules: parsed.data.recycle_rules,
    // null is a real value here: "back to the catalogue defaults".
    dispositionRules:
      parsed.data.disposition_rules === undefined ? undefined : parsed.data.disposition_rules,
    maxAttempts: parsed.data.retry_count,
  });
  if (!report) return fail('Campaign not found', 404);
  return ok(report);
}

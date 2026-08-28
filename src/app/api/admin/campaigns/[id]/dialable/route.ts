import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { dialStatusesSchema, recycleRulesSchema, dispositionRulesSchema } from '@/lib/lists';
import { dialableReport } from '@/lib/dialerDiag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Same shape the Dial rules modal PATCHes, so a preview cannot drift from a save. */
const previewSchema = z.object({
  dial_statuses: dialStatusesSchema.optional(),
  recycle_rules: recycleRulesSchema.optional(),
  disposition_rules: dispositionRulesSchema.nullable().optional(),
  retry_count: z.number().int().min(0).max(100).optional(),
});

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

/**
 * POST /api/admin/campaigns/:id/dialable
 * Same answer for dial rules that have NOT been saved yet — what the operator
 * currently has selected in the Dial rules modal. Read-only: nothing is stored.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail('Invalid campaign id');

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

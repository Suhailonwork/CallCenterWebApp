import { authenticate, isError, ok, fail } from '@/lib/api';
import { customerHistoryForAgent } from '@/lib/customerHistory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/employee/customers/:phone/history — past calls on this number in the agent's groups. */
export async function GET(_req: Request, { params }: { params: { phone: string } }) {
  const u = await authenticate(['employee']);
  if (isError(u)) return u;

  const phone = decodeURIComponent(params.phone).trim();
  if (!phone) return fail('Invalid phone number');

  return ok(await customerHistoryForAgent(u.id, phone));
}

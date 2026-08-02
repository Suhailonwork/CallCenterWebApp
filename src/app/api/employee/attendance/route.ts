import { authenticate, isError, ok } from '@/lib/api';
import { employeeAttendance } from '@/lib/attendance';

export const runtime = 'nodejs';

/** GET /api/employee/attendance — the signed-in employee's own attendance. */
export async function GET(req: Request) {
  const u = await authenticate(['employee']);
  if (isError(u)) return u;

  const sp = new URL(req.url).searchParams;
  const data = await employeeAttendance(
    u.id,
    Number(sp.get('page')) || 1,
    Number(sp.get('pageSize')) || 30,
  );
  return ok(data);
}

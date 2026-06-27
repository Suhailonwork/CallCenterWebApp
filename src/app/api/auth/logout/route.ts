import { TOKEN_COOKIE } from '@/lib/jwt';
import { authenticate, isError, ok } from '@/lib/api';
import { closeSession } from '@/lib/sessions';
import { recordLogout } from '@/lib/attendance';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST() {
  // Close the agent's login session before clearing the cookie.
  const user = await authenticate();
  if (!isError(user)) {
    // Attendance tracking — close the open session for every role.
    await recordLogout(user.id, 'manual');
    await logAudit({ userId: user.id, action: 'logout', entity: 'users', entityId: user.id });
    if (user.role === 'employee') {
      await closeSession(user.id);
    }
  }

  const res = ok({ ok: true });
  res.cookies.set(TOKEN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}

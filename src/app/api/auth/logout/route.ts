import { TOKEN_COOKIE } from '@/lib/jwt';
import { authenticate, isError, ok } from '@/lib/api';
import { closeSession } from '@/lib/sessions';

export const runtime = 'nodejs';

export async function POST() {
  // Close the agent's login session before clearing the cookie.
  const user = await authenticate();
  if (!isError(user) && user.role === 'employee') {
    await closeSession(user.id);
  }

  const res = ok({ ok: true });
  res.cookies.set(TOKEN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}

import { authenticate, isError, ok, fail } from '@/lib/api';
import { queryOne } from '@/lib/db';

export const runtime = 'nodejs';

/** GET /api/employee/sip - SIP/WebRTC credentials for the logged-in employee. */
export async function GET() {
  const user = await authenticate(['employee']);
  if (isError(user)) return user;

  const emp = await queryOne<{ sip_extension: string; sip_password: string }>(
    'SELECT sip_extension, sip_password FROM employees WHERE user_id = ?',
    [user.id],
  );
  if (!emp) return fail('No SIP extension configured for this account', 404);

  const sipServer = process.env.SIP_SERVER ?? '192.168.0.101';
  console.log("SIP_WSS_URL =", process.env.SIP_WSS_URL);
console.log("SIP_SERVER  =", process.env.SIP_SERVER);
  return ok({
    wssUrl: process.env.SIP_WSS_URL ?? `wss://${sipServer}:8089/ws`,
    sipServer,
    extension: emp.sip_extension,
    password: emp.sip_password,
    displayName: user.name,
  });
}

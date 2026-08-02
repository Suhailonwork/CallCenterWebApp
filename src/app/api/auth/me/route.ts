import { authenticate, isError, ok } from '@/lib/api';

export const runtime = 'nodejs';

export async function GET() {
  const user = await authenticate();
  if (isError(user)) return user;
  return ok({ user });
}

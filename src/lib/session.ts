import { cookies } from 'next/headers';
import { TOKEN_COOKIE, verifyToken, type SessionPayload } from './jwt';
import { queryOne } from './db';
import type { Role } from '@/types';

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  team_id: number | null;
}

/** Decode the session cookie (no DB hit). Server components / route handlers. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** Load the current user fresh from the database. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;
  return queryOne<CurrentUser>(
    'SELECT id, name, email, role, team_id FROM users WHERE id = ? AND is_active = 1',
    [Number(session.sub)],
  );
}

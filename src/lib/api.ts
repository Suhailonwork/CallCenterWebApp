import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TOKEN_COOKIE, verifyToken } from './jwt';
import { queryOne } from './db';
import type { ZodError } from 'zod';
import type { Role } from '@/types';

export interface AuthedUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  team_id: number | null;
}

/**
 * Authenticate an API request. Returns the user, or a NextResponse error
 * (401 / 403) that the route should return directly.
 *
 *   const user = await authenticate(['employee']);
 *   if (isError(user)) return user;
 */
export async function authenticate(roles?: Role[]): Promise<AuthedUser | NextResponse> {
  const token = cookies().get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await queryOne<AuthedUser>(
    'SELECT id, name, email, role, team_id FROM users WHERE id = ? AND is_active = 1',
    [Number(session.sub)],
  );
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (roles && !roles.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return user;
}

export function isError(x: AuthedUser | NextResponse): x is NextResponse {
  return x instanceof NextResponse;
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Turn a Zod failure into the message the operator actually needs.
 *
 * `fallback` stays the answer for the ordinary "the client sent garbage" case,
 * where naming a field would only confuse. A `custom` issue is different: it
 * comes from a rule the schema spells out in plain language — a duplicate
 * recycle rule, say — and hiding it behind "Invalid data" leaves the operator
 * staring at a form that looks right, with no idea which row the server
 * refused.
 */
export function failValidation(error: ZodError, fallback: string) {
  const spelled = error.issues.find((i) => i.code === 'custom');
  return fail(spelled?.message ?? fallback);
}

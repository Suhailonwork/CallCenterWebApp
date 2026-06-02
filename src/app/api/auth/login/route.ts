import { z } from 'zod';
import { queryOne } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { signToken, TOKEN_COOKIE } from '@/lib/jwt';
import { ROLE_HOME } from '@/lib/rbac';
import { ok, fail } from '@/lib/api';
import { openSession } from '@/lib/sessions';
import type { Role } from '@/types';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  password_hash: string;
  is_active: number;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail('Invalid email or password format');

  const { email, password } = parsed.data;

  const user = await queryOne<UserRow>(
    'SELECT id, name, email, role, password_hash, is_active FROM users WHERE email = ?',
    [email],
  );
  if (!user || !user.is_active) return fail('Invalid credentials', 401);

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return fail('Invalid credentials', 401);

  // Start a login session for agents (used for login-hours tracking).
  if (user.role === 'employee') {
    await openSession(user.id);
  }

  const token = await signToken({
    sub: String(user.id),
    role: user.role,
    name: user.name,
    email: user.email,
  });

  const res = ok({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    redirect: ROLE_HOME[user.role],
  });
  res.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return res;
}

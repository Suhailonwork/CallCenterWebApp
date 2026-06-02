import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@/types';

// Edge-runtime safe (used by middleware) - jose only, no Node crypto.

export const TOKEN_COOKIE = 'cc_token';

export interface SessionPayload {
  sub: string;
  role: Role;
  name: string;
  email: string;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
  );
}

export async function signToken(p: SessionPayload): Promise<string> {
  return new SignJWT({ role: p.role, name: p.name, email: p.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN ?? '8h')
    .sign(secret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      role: payload.role as Role,
      name: String(payload.name ?? ''),
      email: String(payload.email ?? ''),
    };
  } catch {
    return null;
  }
}

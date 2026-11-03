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
  const value = process.env.JWT_SECRET;
  if (!value && process.env.NODE_ENV === 'production') {
    // The development fallback is public; signing or accepting tokens with it
    // in production would make every session forgeable. Fail closed instead.
    throw new Error('JWT_SECRET is not set');
  }
  return new TextEncoder().encode(value ?? 'dev-insecure-secret-change-me');
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

import bcrypt from 'bcryptjs';

/** Hash a plaintext password. Node runtime only. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/** Compare a plaintext password against a stored hash. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

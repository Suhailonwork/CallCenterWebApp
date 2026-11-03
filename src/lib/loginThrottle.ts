/**
 * Brute-force protection for the login route.
 *
 * Failures are counted per email + IP, so one person's typos cannot lock a
 * colleague out, with a higher ceiling per IP to stop one machine walking
 * through every account. Kept in memory: the app is a single process, and a
 * restart forgetting the counters is harmless.
 */
const MAX_PER_ACCOUNT = 10;
const MAX_PER_IP = 50;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED = 10_000;

interface Counter {
  count: number;
  resetAt: number;
}

const counters = new Map<string, Counter>();

function current(key: string, now: number): Counter | null {
  const c = counters.get(key);
  if (!c) return null;
  if (c.resetAt <= now) {
    counters.delete(key);
    return null;
  }
  return c;
}

function bump(key: string, now: number) {
  const c = current(key, now);
  if (c) {
    c.count += 1;
    return;
  }
  // A flood of made-up emails must not grow this map without limit.
  if (counters.size >= MAX_TRACKED) {
    counters.forEach((v, k) => {
      if (v.resetAt <= now) counters.delete(k);
    });
    if (counters.size >= MAX_TRACKED) counters.clear();
  }
  counters.set(key, { count: 1, resetAt: now + WINDOW_MS });
}

const accountKey = (email: string, ip: string | null) => `a|${email.toLowerCase()}|${ip ?? ''}`;
const ipKey = (ip: string | null) => `i|${ip ?? ''}`;

/** True when this attempt must be refused without checking the password. */
export function loginBlocked(email: string, ip: string | null, now = Date.now()): boolean {
  return (
    (current(accountKey(email, ip), now)?.count ?? 0) >= MAX_PER_ACCOUNT ||
    (current(ipKey(ip), now)?.count ?? 0) >= MAX_PER_IP
  );
}

export function recordLoginFailure(email: string, ip: string | null, now = Date.now()) {
  bump(accountKey(email, ip), now);
  bump(ipKey(ip), now);
}

/** A good password clears that account's count, not the IP's. */
export function clearLoginFailures(email: string, ip: string | null) {
  counters.delete(accountKey(email, ip));
}

/**
 * audit.ts — centralised, production-grade audit logging.
 *
 * Every security-relevant action goes through `logAudit`, which records who
 * did what, to which entity, with optional structured `details`, and the
 * client IP. Audit writes never throw: a failed audit insert must not break
 * the underlying request, so errors are swallowed and logged to the server.
 */
import { headers } from 'next/headers';
import { pool } from './db';

// Pool or a transaction connection — both expose .execute(). Lets callers
// record the audit row inside the same transaction as the change itself.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlExecutor = { execute: (sql: string, values?: any[]) => Promise<any> };

export interface AuditEntry {
  /** Acting user id, or null for system / unauthenticated actions. */
  userId: number | null;
  /** Machine action name, e.g. 'create_user', 'login', 'delete_gateway'. */
  action: string;
  /** Table / object type the action touched, e.g. 'users'. */
  entity?: string | null;
  /** Primary key of the affected row, if any. */
  entityId?: number | null;
  /** Any extra structured context — stored as JSON. */
  details?: unknown;
}

/** Best-effort client IP from the proxy headers, capped to the column width. */
export function clientIp(): string | null {
  try {
    const h = headers();
    const xff = h.get('x-forwarded-for');
    const ip =
      (xff ? xff.split(',')[0] : null) ??
      h.get('x-real-ip') ??
      h.get('cf-connecting-ip');
    return ip ? ip.trim().slice(0, 64) : null;
  } catch {
    return null;
  }
}

/**
 * Record an audit-log entry. Safe to await or fire-and-forget; it resolves
 * even on failure. Pass a transaction connection as `executor` to make the
 * audit row part of the same atomic change.
 */
export async function logAudit(
  entry: AuditEntry,
  executor: SqlExecutor = pool,
): Promise<void> {
  try {
    await executor.execute(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip)
       VALUES (?,?,?,?,?,?)`,
      [
        entry.userId,
        entry.action,
        entry.entity ?? null,
        entry.entityId ?? null,
        entry.details === undefined ? null : JSON.stringify(entry.details),
        clientIp(),
      ],
    );
  } catch (err) {
    // Auditing must never break the request it is recording.
    console.error('[audit] failed to write audit log:', err);
  }
}

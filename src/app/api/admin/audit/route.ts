import { authenticate, isError, ok } from '@/lib/api';
import { query } from '@/lib/db';
import type { AuditRow } from '@/types';

export const runtime = 'nodejs';

/** GET /api/admin/audit - the 200 most recent audit-log entries. */
export async function GET() {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const entries = await query<AuditRow>(
    `SELECT a.id, u.name AS user_name, a.action, a.entity, a.entity_id,
            DATE_FORMAT(a.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC
      LIMIT 200`,
  );
  return ok({ entries });
}

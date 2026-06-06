import { authenticate, isError, ok } from '@/lib/api';
import { query, queryOne } from '@/lib/db';
import type { AuditRow } from '@/types';

export const runtime = 'nodejs';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

/**
 * GET /api/admin/audit — paginated, filterable audit log.
 *
 * Query params:
 *   page      1-based page number (default 1)
 *   pageSize  rows per page (default 50, max 100)
 *   action    exact action filter, e.g. "login_failed"
 *   entity    exact entity filter, e.g. "users"
 *   userId    acting user id
 *   q         free-text search across action / entity
 */
export async function GET(req: Request) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(sp.get('pageSize')) || DEFAULT_PAGE_SIZE),
  );
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const params: unknown[] = [];

  const action = sp.get('action');
  if (action) {
    where.push('a.action = ?');
    params.push(action);
  }
  const entity = sp.get('entity');
  if (entity) {
    where.push('a.entity = ?');
    params.push(entity);
  }
  const userId = sp.get('userId');
  if (userId && Number.isFinite(Number(userId))) {
    where.push('a.user_id = ?');
    params.push(Number(userId));
  }
  const q = sp.get('q')?.trim();
  if (q) {
    where.push('(a.action LIKE ? OR a.entity LIKE ? OR u.name LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${whereSql}`,
    params,
  );
  const total = totalRow?.total ?? 0;

  const entries = await query<AuditRow>(
    `SELECT a.id, u.name AS user_name, a.user_id, a.action, a.entity, a.entity_id,
            a.details, a.ip,
            DATE_FORMAT(a.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${whereSql}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );

  // Distinct actions power the filter dropdown in the UI.
  const actionRows = await query<{ action: string }>(
    `SELECT DISTINCT action FROM audit_logs ORDER BY action`,
  );

  return ok({
    entries,
    actions: actionRows.map((r) => r.action),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

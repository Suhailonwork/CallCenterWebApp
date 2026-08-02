import { authenticate, isError, ok } from '@/lib/api';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

/** GET /api/admin/agent-stats — per-employee live stats for today. */
export async function GET() {
  const u = await authenticate(['admin', 'manager']);
  if (isError(u)) return u;

  const [rows] = await pool.execute(
    `SELECT
       u.id,
       u.name                                   AS employee,
       u.role                                   AS role,
       COALESCE(e.status, 'offline')            AS status,
       COALESCE(cs.calls, 0)                    AS calls,
       COALESCE(cs.connected, 0)                AS connected,
       COALESCE(cs.success, 0)                  AS success,
       COALESCE(cs.talk_seconds, 0)             AS talkSeconds,
       COALESCE(ss.login_seconds, 0)            AS loginSeconds
     FROM users u
     LEFT JOIN employees e ON e.user_id = u.id
     LEFT JOIN (
       SELECT employee_id,
              COUNT(*)                                  AS calls,
              SUM(status IN ('connected','completed'))  AS connected,
              SUM(status = 'completed')                 AS success,
              SUM(duration_seconds)                     AS talk_seconds
       FROM calls
       WHERE created_at >= CURDATE()
       GROUP BY employee_id
     ) cs ON cs.employee_id = u.id
     LEFT JOIN (
       SELECT employee_id,
              SUM(TIMESTAMPDIFF(SECOND, login_at, COALESCE(logout_at, NOW()))) AS login_seconds
       FROM agent_sessions
       WHERE login_at >= CURDATE()
       GROUP BY employee_id
     ) ss ON ss.employee_id = u.id
     WHERE u.role IN ('manager', 'tl', 'employee')
     ORDER BY FIELD(u.role, 'manager', 'tl', 'employee'), u.name`,
  );

  return ok({ agents: rows });
}
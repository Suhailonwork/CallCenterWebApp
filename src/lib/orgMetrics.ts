import { query, queryOne } from './db';
import { loginSecondsByEmployee } from './sessions';
import type { EmployeeStat, SystemKpis } from '@/types';

/** Today's call stats for a set of employees (by user id). */
export async function statsForEmployees(ids: number[]): Promise<EmployeeStat[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  // The per-employee call rollup and the login-seconds lookup are independent —
  // run them concurrently. The calls join uses a sargable created_at range so it
  // can use the index instead of DATE(c.created_at).
  const [rows, loginSecs] = await Promise.all([
    query<any>(
      `SELECT u.id, u.name,
              COALESCE(e.status, 'offline') AS status,
              COUNT(c.id) AS calls,
              COALESCE(SUM(c.status = 'connected'), 0) AS connected,
              COALESCE(SUM(c.duration_seconds), 0) AS talk
         FROM users u
         LEFT JOIN employees e ON e.user_id = u.id
         LEFT JOIN calls c
           ON c.employee_id = u.id
          AND c.created_at >= CURDATE()
          AND c.created_at < CURDATE() + INTERVAL 1 DAY
        WHERE u.id IN (${placeholders})
        GROUP BY u.id, u.name, e.status
        ORDER BY u.name`,
      ids,
    ),
    loginSecondsByEmployee(ids),
  ]);
  return rows.map((r) => {
    const calls = Number(r.calls);
    const connected = Number(r.connected);
    return {
      id: Number(r.id),
      name: r.name,
      status: r.status,
      calls,
      connected,
      successRate: calls > 0 ? Math.round((connected / calls) * 100) : 0,
      talkSeconds: Number(r.talk),
      loginSeconds: loginSecs[Number(r.id)] ?? 0,
    };
  });
}

/**
 * System-wide KPIs for the Admin dashboard.
 *
 * `calls` now holds one row per DIAL ATTEMPT, including the machine-dialed
 * ones that never reached an agent — that is the number an outbound operation
 * wants ("attempts today"), and successRate becomes the connect rate. Rows for
 * calls still on the wire are excluded so a ringing line does not tick the
 * counter up and then change its mind.
 */
export async function systemKpis(): Promise<SystemKpis> {
  const r = await queryOne<any>(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE role='employee' AND is_active=1) AS employees,
       (SELECT COUNT(*) FROM users WHERE role='manager' AND is_active=1) AS managers,
       (SELECT COUNT(*) FROM users WHERE role='tl' AND is_active=1) AS tls,
       (SELECT COUNT(*) FROM teams) AS teams,
       (SELECT COUNT(*) FROM campaigns) AS campaigns,
       (SELECT COUNT(*) FROM csv_data) AS contacts,
       (SELECT COUNT(*) FROM calls
         WHERE created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY
           AND status NOT IN ('dialing','ringing')) AS callsToday,
       (SELECT COALESCE(SUM(status='connected'),0)
          FROM calls
         WHERE created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY) AS connectedToday`,
  );
  const callsToday = Number(r?.callsToday ?? 0);
  const connectedToday = Number(r?.connectedToday ?? 0);
  return {
    employees: Number(r?.employees ?? 0),
    managers: Number(r?.managers ?? 0),
    tls: Number(r?.tls ?? 0),
    teams: Number(r?.teams ?? 0),
    campaigns: Number(r?.campaigns ?? 0),
    contacts: Number(r?.contacts ?? 0),
    callsToday,
    connectedToday,
    successRate: callsToday > 0 ? Math.round((connectedToday / callsToday) * 100) : 0,
  };
}

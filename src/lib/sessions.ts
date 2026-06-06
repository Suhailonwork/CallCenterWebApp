import { query } from './db';

/** Start a login session for an employee (closing any dangling open one). */
export async function openSession(employeeId: number) {
  await query(
    'UPDATE agent_sessions SET logout_at = NOW() WHERE employee_id = ? AND logout_at IS NULL',
    [employeeId],
  );
  await query(
    'INSERT INTO agent_sessions (employee_id, login_at) VALUES (?, NOW())',
    [employeeId],
  );
}

/** Close the open login session for an employee. */
export async function closeSession(employeeId: number) {
  await query(
    'UPDATE agent_sessions SET logout_at = NOW() WHERE employee_id = ? AND logout_at IS NULL',
    [employeeId],
  );
}

/** Today's login seconds for a set of employees, keyed by user id. */
export async function loginSecondsByEmployee(
  ids: number[],
): Promise<Record<number, number>> {
  if (ids.length === 0) return {};
  const ph = ids.map(() => '?').join(',');
  const rows = await query<{ employee_id: number; secs: number }>(
    `SELECT employee_id,
            COALESCE(
              SUM(TIMESTAMPDIFF(SECOND, login_at, COALESCE(logout_at, NOW()))), 0
            ) AS secs
       FROM agent_sessions
      WHERE employee_id IN (${ph}) AND login_at >= CURDATE()
      GROUP BY employee_id`,
    ids,
  );
  const out: Record<number, number> = {};
  for (const r of rows) out[Number(r.employee_id)] = Number(r.secs);
  return out;
}

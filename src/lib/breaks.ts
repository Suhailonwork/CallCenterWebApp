import { query } from './db';
import type { BreakRequest } from '@/types';

const SELECT = `
  SELECT b.id, b.employee_id, u.name AS employee_name,
         b.break_type, b.reason, b.status,
         DATE_FORMAT(b.start_time, '%Y-%m-%dT%H:%i:%s') AS start_time,
         DATE_FORMAT(b.end_time,   '%Y-%m-%dT%H:%i:%s') AS end_time,
         DATE_FORMAT(b.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
    FROM breaks b
    JOIN users u ON u.id = b.employee_id`;

/** Breaks for a set of employees filtered by status - for approval screens. */
export async function breaksForEmployees(
  employeeIds: number[],
  statuses: string[],
): Promise<BreakRequest[]> {
  if (employeeIds.length === 0 || statuses.length === 0) return [];
  const idPh = employeeIds.map(() => '?').join(',');
  const stPh = statuses.map(() => '?').join(',');
  return query<BreakRequest>(
    `${SELECT}
      WHERE b.employee_id IN (${idPh}) AND b.status IN (${stPh})
      ORDER BY b.created_at DESC
      LIMIT 100`,
    [...employeeIds, ...statuses],
  );
}

/** Recent break history for a single employee. */
export async function employeeBreaks(employeeId: number): Promise<BreakRequest[]> {
  return query<BreakRequest>(
    `${SELECT}
      WHERE b.employee_id = ?
      ORDER BY b.created_at DESC
      LIMIT 15`,
    [employeeId],
  );
}

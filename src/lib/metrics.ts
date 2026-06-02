import { query, queryOne } from './db';
import type { EmployeeDashboard, CallRow, ScheduledCall } from '@/types';

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** All data for the employee dashboard, computed from the calls table. */
export async function getEmployeeDashboard(userId: number): Promise<EmployeeDashboard> {
  // These five queries are independent, so fire them concurrently rather than
  // awaiting one after another. Date filters use sargable ranges
  // (created_at >= CURDATE()) so they hit idx_calls_employee_created instead of
  // wrapping the column in DATE().
  const [today, brk, rows, scheduled, recentCalls] = await Promise.all([
    queryOne<{ calls: number; connected: number; duration: number }>(
      `SELECT COUNT(*) AS calls,
              COALESCE(SUM(status = 'connected'), 0) AS connected,
              COALESCE(SUM(duration_seconds), 0) AS duration
         FROM calls
        WHERE employee_id = ?
          AND created_at >= CURDATE()
          AND created_at < CURDATE() + INTERVAL 1 DAY`,
      [userId],
    ),
    queryOne<{ secs: number }>(
      `SELECT COALESCE(
                SUM(TIMESTAMPDIFF(SECOND, start_time, COALESCE(end_time, NOW()))), 0) AS secs
         FROM breaks
        WHERE employee_id = ?
          AND created_at >= CURDATE()
          AND created_at < CURDATE() + INTERVAL 1 DAY
          AND status IN ('active', 'completed')`,
      [userId],
    ),
    query<{ d: string; calls: number; connected: number }>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d,
              COUNT(*) AS calls,
              COALESCE(SUM(status = 'connected'), 0) AS connected
         FROM calls
        WHERE employee_id = ?
          AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')`,
      [userId],
    ),
    query<ScheduledCall>(
      `SELECT id, phone_number, contact_name,
              DATE_FORMAT(scheduled_at, '%Y-%m-%dT%H:%i:%s') AS scheduled_at, status
         FROM scheduled_calls
        WHERE assigned_to = ? AND status = 'pending'
        ORDER BY scheduled_at ASC
        LIMIT 10`,
      [userId],
    ),
    query<CallRow>(
      `SELECT id, phone_number, contact_name, status, duration_seconds,
              DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
         FROM calls
        WHERE employee_id = ?
        ORDER BY created_at DESC
        LIMIT 8`,
      [userId],
    ),
  ]);

  const calls = Number(today?.calls ?? 0);
  const connected = Number(today?.connected ?? 0);
  const durationSeconds = Number(today?.duration ?? 0);

  const chart: EmployeeDashboard['chart'] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    const found = rows.find((r) => r.d === key);
    chart.push({
      date: key,
      calls: Number(found?.calls ?? 0),
      connected: Number(found?.connected ?? 0),
    });
  }

  return {
    today: {
      calls,
      connected,
      successRate: calls > 0 ? Math.round((connected / calls) * 100) : 0,
      durationSeconds,
      breakSeconds: Number(brk?.secs ?? 0),
    },
    scheduledCount: scheduled.length,
    chart,
    recentCalls,
    scheduled,
  };
}

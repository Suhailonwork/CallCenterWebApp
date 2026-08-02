/**
 * attendance.ts — Attendance & Login Tracking core.
 *
 * One row per login lives in `attendance_sessions`. The login route calls
 * `recordLogin`, logout calls `recordLogout`, and an invisible client
 * heartbeat calls `touchSession`. Reads (`buildAttendance`,
 * `employeeAttendance`) power the Admin / TL / Employee screens.
 *
 * Timezone: every calendar boundary is Indian Standard Time (Asia/Kolkata).
 * To stay correct regardless of the MySQL server / OS timezone, we compute
 * IST wall-clock strings in Node and store them literally, and always read
 * back with DATE_FORMAT so mysql2 never re-interprets the timezone.
 *
 * Like audit logging, the write helpers NEVER throw — a failed attendance
 * write must not break login/logout.
 */
import { randomUUID } from 'crypto';
import { query, queryOne } from './db';
import type { Role } from '@/types';

/** A session is "online" if its heartbeat was seen within this many minutes. */
export const ONLINE_THRESHOLD_MIN = 3;
/** Open sessions whose heartbeat is older than this are swept to 'expired'. */
export const STALE_SESSION_MIN = 15;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export interface IstParts {
  /** YYYY-MM-DD (IST). */
  date: string;
  /** HH:MM:SS (IST). */
  time: string;
  /** YYYY-MM-DD HH:MM:SS (IST) — safe to store / compare in MySQL. */
  datetime: string;
  /** Seconds since IST midnight, for punctuality maths. */
  secondsOfDay: number;
}

/** IST wall-clock parts for a given instant (default: now). */
export function istParts(at: Date = new Date()): IstParts {
  // Shift by +05:30 and read the UTC fields => IST wall clock.
  const ist = new Date(at.getTime() + IST_OFFSET_MS);
  const iso = ist.toISOString();
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 19),
    datetime: `${iso.slice(0, 10)} ${iso.slice(11, 19)}`,
    secondsOfDay:
      ist.getUTCHours() * 3600 + ist.getUTCMinutes() * 60 + ist.getUTCSeconds(),
  };
}

/** IST datetime string `minutesAgo` minutes before now (for freshness checks). */
export function istDatetimeMinutesAgo(minutesAgo: number): string {
  return istParts(new Date(Date.now() - minutesAgo * 60_000)).datetime;
}

/** "HH:MM[:SS]" -> seconds since midnight. */
export function timeToSeconds(t: string): number {
  const [h = '0', m = '0', s = '0'] = String(t).split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

export type AttendanceStatus = 'on_time' | 'grace' | 'late';

/** Punctuality of a login vs a shift start + grace window. */
export function computeStatus(
  loginSecondsOfDay: number,
  shiftStartSeconds: number,
  graceMinutes: number,
): { status: AttendanceStatus; lateSeconds: number } {
  const lateSeconds = Math.max(0, loginSecondsOfDay - shiftStartSeconds);
  if (loginSecondsOfDay <= shiftStartSeconds) return { status: 'on_time', lateSeconds: 0 };
  if (loginSecondsOfDay <= shiftStartSeconds + graceMinutes * 60)
    return { status: 'grace', lateSeconds };
  return { status: 'late', lateSeconds };
}

// ---------------------------------------------------------------------------
//  Writes (login / logout / heartbeat). These never throw.
// ---------------------------------------------------------------------------

/**
 * Record a login. Snapshots the user's TL + shift, computes punctuality
 * against the shift, closes any dangling open session for the same user
 * (duplicate-login prevention), and inserts a fresh attendance row.
 */
export async function recordLogin(params: {
  userId: number;
  role: Role;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    const now = istParts();
    const u = await queryOne<{ reports_to: number | null; shift_id: number | null }>(
      'SELECT reports_to, shift_id FROM users WHERE id = ?',
      [params.userId],
    );
    const tlId = u?.reports_to ?? null;
    const shiftId = u?.shift_id ?? null;

    let status: AttendanceStatus | null = null;
    let lateSeconds = 0;
    if (shiftId) {
      const s = await queryOne<{ start_time: string; grace_minutes: number }>(
        'SELECT start_time, grace_minutes FROM shifts WHERE id = ? AND is_active = 1',
        [shiftId],
      );
      if (s) {
        const c = computeStatus(
          now.secondsOfDay,
          timeToSeconds(s.start_time),
          Number(s.grace_minutes),
        );
        status = c.status;
        lateSeconds = c.lateSeconds;
      }
    }

    // Close any still-open session for this user before opening a new one.
    await query(
      `UPDATE attendance_sessions
          SET logout_at = COALESCE(last_seen_at, ?),
              logout_reason = 'expired',
              duration_seconds = TIMESTAMPDIFF(SECOND, login_at, COALESCE(last_seen_at, ?))
        WHERE user_id = ? AND logout_at IS NULL`,
      [now.datetime, now.datetime, params.userId],
    );

    await query(
      `INSERT INTO attendance_sessions
         (user_id, role, tl_id, shift_id, work_date, login_at, status,
          late_seconds, ip, user_agent, session_id, last_seen_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        params.userId,
        params.role,
        tlId,
        shiftId,
        now.date,
        now.datetime,
        status,
        lateSeconds,
        params.ip ?? null,
        params.userAgent ? params.userAgent.slice(0, 255) : null,
        randomUUID(),
        now.datetime,
      ],
    );
  } catch (err) {
    console.error('[attendance] recordLogin failed:', err);
  }
}

/** Close the open session for a user (manual / force / timeout / expired). */
export async function recordLogout(
  userId: number,
  reason: 'manual' | 'force' | 'timeout' | 'expired' = 'manual',
): Promise<void> {
  try {
    const now = istParts();
    await query(
      `UPDATE attendance_sessions
          SET logout_at = ?, logout_reason = ?, last_seen_at = ?,
              duration_seconds = TIMESTAMPDIFF(SECOND, login_at, ?)
        WHERE user_id = ? AND logout_at IS NULL`,
      [now.datetime, reason, now.datetime, now.datetime, userId],
    );
  } catch (err) {
    console.error('[attendance] recordLogout failed:', err);
  }
}

/** Heartbeat: bump last_seen on the user's open session. Never throws. */
export async function touchSession(userId: number): Promise<void> {
  try {
    const now = istParts();
    await query(
      `UPDATE attendance_sessions SET last_seen_at = ?
        WHERE user_id = ? AND logout_at IS NULL`,
      [now.datetime, userId],
    );
  } catch (err) {
    console.error('[attendance] touchSession failed:', err);
  }
}

/**
 * Best-effort close of sessions whose heartbeat went stale (browser closed,
 * crash, network drop). Logs them out at their last heartbeat. Called lazily
 * from the admin/TL reads so correctness is eventual without a cron.
 */
export async function sweepStaleSessions(
  thresholdMinutes = STALE_SESSION_MIN,
): Promise<void> {
  try {
    const cutoff = istDatetimeMinutesAgo(thresholdMinutes);
    await query(
      `UPDATE attendance_sessions
          SET logout_at = last_seen_at, logout_reason = 'expired',
              duration_seconds = TIMESTAMPDIFF(SECOND, login_at, last_seen_at)
        WHERE logout_at IS NULL
          AND last_seen_at IS NOT NULL
          AND last_seen_at < ?`,
      [cutoff],
    );
  } catch (err) {
    console.error('[attendance] sweepStaleSessions failed:', err);
  }
}

// ---------------------------------------------------------------------------
//  Date-range presets (resolved server-side so IST is authoritative).
// ---------------------------------------------------------------------------

export type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Resolve a preset (or a validated custom from/to) into an IST date range. */
export function resolveRange(
  preset: string | null,
  from?: string | null,
  to?: string | null,
): { from: string; to: string; preset: DatePreset } {
  const today = istParts().date;
  const dayMs = 86_400_000;
  // Build a Date at IST-midnight for arithmetic (treat IST date as UTC).
  const istMidnight = (d: string) => new Date(`${d}T00:00:00Z`);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  switch (preset) {
    case 'yesterday': {
      const y = fmt(new Date(istMidnight(today).getTime() - dayMs));
      return { from: y, to: y, preset: 'yesterday' };
    }
    case 'week': {
      // Monday-based week containing today.
      const t = istMidnight(today);
      const dow = (t.getUTCDay() + 6) % 7; // 0 = Monday
      const start = fmt(new Date(t.getTime() - dow * dayMs));
      return { from: start, to: today, preset: 'week' };
    }
    case 'month': {
      const start = `${today.slice(0, 7)}-01`;
      return { from: start, to: today, preset: 'month' };
    }
    case 'custom': {
      const f = from && DATE_RE.test(from) ? from : today;
      const t = to && DATE_RE.test(to) ? to : today;
      return f <= t ? { from: f, to: t, preset: 'custom' } : { from: t, to: f, preset: 'custom' };
    }
    case 'today':
    default:
      return { from: today, to: today, preset: 'today' };
  }
}

// ---------------------------------------------------------------------------
//  Reads. `buildAttendance` serves Admin + TL; scope is the explicit set of
//  users the caller is allowed to see, so RBAC can never leak.
// ---------------------------------------------------------------------------

export interface ScopeUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  tl_name: string | null;
  shift_id: number | null;
  shift_name: string | null;
  shift_start: string | null;
  grace_minutes: number | null;
}

/**
 * Scope users (with shift + TL metadata). Pass `ids = null` for "all active
 * users" (admin, no narrowing filter); pass an explicit id list otherwise.
 * An empty id list returns [] (nothing in scope).
 */
export async function getScopeUsers(ids: number[] | null): Promise<ScopeUser[]> {
  if (ids && ids.length === 0) return [];
  const where = ids ? `AND u.id IN (${ids.map(() => '?').join(',')})` : '';
  return query<ScopeUser>(
    `SELECT u.id, u.name, u.email, u.role,
            tl.name AS tl_name,
            u.shift_id, s.name AS shift_name,
            TIME_FORMAT(s.start_time, '%H:%i') AS shift_start,
            s.grace_minutes
       FROM users u
       LEFT JOIN users tl ON tl.id = u.reports_to
       LEFT JOIN shifts s ON s.id = u.shift_id
      WHERE u.is_active = 1 ${where}
      ORDER BY u.name`,
    ids ?? [],
  );
}

/** Agent ids that belong to a group owning the given campaign. */
export async function agentIdsForCampaign(campaignId: number): Promise<number[]> {
  const rows = await query<{ agent_id: number }>(
    `SELECT DISTINCT ga.agent_id
       FROM group_agents ga
       JOIN campaigns c ON c.group_id = ga.group_id
      WHERE c.id = ?`,
    [campaignId],
  );
  return rows.map((r) => Number(r.agent_id));
}

export interface AttendanceFilters {
  from: string;
  to: string;
  status?: string | null; // on_time|grace|late|logged_in|logged_out|absent
  q?: string | null;
  page?: number;
  pageSize?: number;
}

export interface BoardRow {
  userId: number;
  name: string;
  email: string;
  role: Role;
  tlName: string | null;
  shiftName: string | null;
  shiftStart: string | null;
  present: boolean;
  online: boolean;
  status: AttendanceStatus | null;
  firstLogin: string | null;
  lastLogout: string | null;
  totalSeconds: number;
  sessions: number;
}

export interface SessionRow {
  id: number;
  userId: number;
  userName: string;
  email: string;
  role: Role;
  tlName: string | null;
  shiftName: string | null;
  workDate: string;
  loginAt: string;
  logoutAt: string | null;
  durationSeconds: number;
  status: AttendanceStatus | null;
  lateSeconds: number;
  logoutReason: string | null;
  ip: string | null;
  userAgent: string | null;
  online: boolean;
}

export interface AttendanceSummary {
  totalUsers: number;
  present: number;
  absent: number;
  loggedIn: number;
  loggedOut: number;
  onTime: number;
  grace: number;
  late: number;
  totalWorkSeconds: number;
}

const MAX_PAGE_SIZE = 100;

/** Apply a status filter to a board row (live view semantics). */
function boardMatchesStatus(b: BoardRow, status: string): boolean {
  switch (status) {
    case 'logged_in':
      return b.online;
    case 'logged_out':
      return b.present && !b.online;
    case 'absent':
      return !b.present;
    case 'on_time':
    case 'grace':
    case 'late':
      return b.status === status;
    default:
      return true;
  }
}

/**
 * Full Admin/TL payload for a set of scope users + filters: live board
 * (one row per scope user), summary counts, and the paginated session log.
 */
export async function buildAttendance(
  scopeUsers: ScopeUser[],
  filters: AttendanceFilters,
) {
  const now = istParts();
  const fresh = istDatetimeMinutesAgo(ONLINE_THRESHOLD_MIN);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const empty = {
    board: [] as BoardRow[],
    summary: {
      totalUsers: 0, present: 0, absent: 0, loggedIn: 0, loggedOut: 0,
      onTime: 0, grace: 0, late: 0, totalWorkSeconds: 0,
    } as AttendanceSummary,
    rows: [] as SessionRow[],
    total: 0,
    page,
    pageSize,
    totalPages: 1,
  };
  if (scopeUsers.length === 0) return empty;

  const ids = scopeUsers.map((u) => u.id);
  const idPh = ids.map(() => '?').join(',');

  // --- Per-user rollup over the date range ---
  const agg = await query<{
    user_id: number;
    first_login: string | null;
    last_logout: string | null;
    total_seconds: number;
    sessions: number;
    online: number;
    first_status: string | null;
  }>(
    `SELECT user_id,
            DATE_FORMAT(MIN(login_at), '%Y-%m-%dT%H:%i:%s') AS first_login,
            DATE_FORMAT(MAX(logout_at), '%Y-%m-%dT%H:%i:%s') AS last_logout,
            COALESCE(SUM(COALESCE(duration_seconds, TIMESTAMPDIFF(SECOND, login_at, ?))), 0) AS total_seconds,
            COUNT(*) AS sessions,
            MAX(CASE WHEN logout_at IS NULL AND last_seen_at >= ? THEN 1 ELSE 0 END) AS online,
            SUBSTRING_INDEX(GROUP_CONCAT(status ORDER BY login_at SEPARATOR '|'), '|', 1) AS first_status
       FROM attendance_sessions
      WHERE work_date BETWEEN ? AND ? AND user_id IN (${idPh})
      GROUP BY user_id`,
    [now.datetime, fresh, filters.from, filters.to, ...ids],
  );
  const aggMap = new Map(agg.map((a) => [Number(a.user_id), a]));

  const fullBoard: BoardRow[] = scopeUsers.map((u) => {
    const a = aggMap.get(u.id);
    const firstStatus = a?.first_status && a.first_status.length
      ? (a.first_status as AttendanceStatus)
      : null;
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      tlName: u.tl_name,
      shiftName: u.shift_name,
      shiftStart: u.shift_start,
      present: !!a,
      online: !!a && Number(a.online) === 1,
      status: firstStatus,
      firstLogin: a?.first_login ?? null,
      lastLogout: a?.last_logout ?? null,
      totalSeconds: Number(a?.total_seconds ?? 0),
      sessions: Number(a?.sessions ?? 0),
    };
  });

  // Summary is computed from the full (unfiltered) board.
  const summary: AttendanceSummary = {
    totalUsers: fullBoard.length,
    present: fullBoard.filter((b) => b.present).length,
    absent: fullBoard.filter((b) => !b.present).length,
    loggedIn: fullBoard.filter((b) => b.online).length,
    loggedOut: fullBoard.filter((b) => b.present && !b.online).length,
    onTime: fullBoard.filter((b) => b.status === 'on_time').length,
    grace: fullBoard.filter((b) => b.status === 'grace').length,
    late: fullBoard.filter((b) => b.status === 'late').length,
    totalWorkSeconds: fullBoard.reduce((s, b) => s + b.totalSeconds, 0),
  };

  // Display board: apply status + search filters.
  const q = filters.q?.trim().toLowerCase();
  let board = fullBoard;
  if (filters.status) board = board.filter((b) => boardMatchesStatus(b, filters.status!));
  if (q) board = board.filter((b) => b.name.toLowerCase().includes(q) || b.email.toLowerCase().includes(q));

  // --- Session log (paginated) ---
  const rowWhere: string[] = [`a.work_date BETWEEN ? AND ?`, `a.user_id IN (${idPh})`];
  const rowParams: unknown[] = [filters.from, filters.to, ...ids];
  if (filters.status === 'logged_in') rowWhere.push('a.logout_at IS NULL');
  else if (filters.status === 'logged_out') rowWhere.push('a.logout_at IS NOT NULL');
  else if (filters.status === 'on_time' || filters.status === 'grace' || filters.status === 'late') {
    rowWhere.push('a.status = ?');
    rowParams.push(filters.status);
  }
  if (q) {
    rowWhere.push('(LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ?)');
    rowParams.push(`%${q}%`, `%${q}%`);
  }
  const rowWhereSql = `WHERE ${rowWhere.join(' AND ')}`;

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
       FROM attendance_sessions a JOIN users u ON u.id = a.user_id ${rowWhereSql}`,
    rowParams,
  );
  const total = Number(totalRow?.total ?? 0);

  const rawRows = await query<any>(
    `SELECT a.id, a.user_id, u.name AS user_name, u.email, a.role,
            tl.name AS tl_name, s.name AS shift_name,
            DATE_FORMAT(a.work_date, '%Y-%m-%d') AS work_date,
            DATE_FORMAT(a.login_at, '%Y-%m-%dT%H:%i:%s') AS login_at,
            DATE_FORMAT(a.logout_at, '%Y-%m-%dT%H:%i:%s') AS logout_at,
            COALESCE(a.duration_seconds, TIMESTAMPDIFF(SECOND, a.login_at, ?)) AS duration_seconds,
            a.status, a.late_seconds, a.logout_reason, a.ip, a.user_agent,
            CASE WHEN a.logout_at IS NULL AND a.last_seen_at >= ? THEN 1 ELSE 0 END AS online
       FROM attendance_sessions a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN users tl ON tl.id = a.tl_id
       LEFT JOIN shifts s ON s.id = a.shift_id
       ${rowWhereSql}
      ORDER BY a.login_at DESC, a.id DESC
      LIMIT ${pageSize} OFFSET ${offset}`,
    [now.datetime, fresh, ...rowParams],
  );

  const rows: SessionRow[] = rawRows.map((r) => ({
    id: Number(r.id),
    userId: Number(r.user_id),
    userName: r.user_name,
    email: r.email,
    role: r.role,
    tlName: r.tl_name,
    shiftName: r.shift_name,
    workDate: r.work_date,
    loginAt: r.login_at,
    logoutAt: r.logout_at,
    durationSeconds: Number(r.duration_seconds ?? 0),
    status: r.status,
    lateSeconds: Number(r.late_seconds ?? 0),
    logoutReason: r.logout_reason,
    ip: r.ip,
    userAgent: r.user_agent,
    online: Number(r.online) === 1,
  }));

  return {
    board,
    summary,
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** All session rows in range for a scope (no pagination) — used for CSV export. */
export async function attendanceRowsForExport(
  ids: number[],
  from: string,
  to: string,
  status?: string | null,
  q?: string | null,
  cap = 5000,
): Promise<SessionRow[]> {
  if (ids.length === 0) return [];
  const now = istParts();
  const fresh = istDatetimeMinutesAgo(ONLINE_THRESHOLD_MIN);
  const idPh = ids.map(() => '?').join(',');
  const where: string[] = [`a.work_date BETWEEN ? AND ?`, `a.user_id IN (${idPh})`];
  const params: unknown[] = [from, to, ...ids];
  if (status === 'logged_in') where.push('a.logout_at IS NULL');
  else if (status === 'logged_out') where.push('a.logout_at IS NOT NULL');
  else if (status === 'on_time' || status === 'grace' || status === 'late') {
    where.push('a.status = ?');
    params.push(status);
  }
  const ql = q?.trim().toLowerCase();
  if (ql) {
    where.push('(LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ?)');
    params.push(`%${ql}%`, `%${ql}%`);
  }
  const rawRows = await query<any>(
    `SELECT a.id, a.user_id, u.name AS user_name, u.email, a.role,
            tl.name AS tl_name, s.name AS shift_name,
            DATE_FORMAT(a.work_date, '%Y-%m-%d') AS work_date,
            DATE_FORMAT(a.login_at, '%Y-%m-%dT%H:%i:%s') AS login_at,
            DATE_FORMAT(a.logout_at, '%Y-%m-%dT%H:%i:%s') AS logout_at,
            COALESCE(a.duration_seconds, TIMESTAMPDIFF(SECOND, a.login_at, ?)) AS duration_seconds,
            a.status, a.late_seconds, a.logout_reason, a.ip, a.user_agent,
            CASE WHEN a.logout_at IS NULL AND a.last_seen_at >= ? THEN 1 ELSE 0 END AS online
       FROM attendance_sessions a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN users tl ON tl.id = a.tl_id
       LEFT JOIN shifts s ON s.id = a.shift_id
      WHERE ${where.join(' AND ')}
      ORDER BY a.login_at DESC, a.id DESC
      LIMIT ${cap}`,
    [now.datetime, fresh, ...params],
  );
  return rawRows.map((r) => ({
    id: Number(r.id),
    userId: Number(r.user_id),
    userName: r.user_name,
    email: r.email,
    role: r.role,
    tlName: r.tl_name,
    shiftName: r.shift_name,
    workDate: r.work_date,
    loginAt: r.login_at,
    logoutAt: r.logout_at,
    durationSeconds: Number(r.duration_seconds ?? 0),
    status: r.status,
    lateSeconds: Number(r.late_seconds ?? 0),
    logoutReason: r.logout_reason,
    ip: r.ip,
    userAgent: r.user_agent,
    online: Number(r.online) === 1,
  }));
}

/** Human label for a punctuality status. */
export function statusLabel(s: AttendanceStatus | null): string {
  if (s === 'on_time') return 'On time';
  if (s === 'grace') return 'Grace';
  if (s === 'late') return 'Late';
  return 'No shift';
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function hms(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}h ${m}m ${s}s`;
}

/** Render attendance session rows as a CSV download body. */
export function attendanceCsv(rows: SessionRow[]): string {
  const header = [
    'Date', 'Employee', 'Email', 'Role', 'TL', 'Shift', 'Login', 'Logout',
    'Duration', 'Status', 'Late (min)', 'Logout reason', 'IP', 'Device',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.workDate, r.userName, r.email, r.role, r.tlName ?? '', r.shiftName ?? '',
        r.loginAt ?? '', r.logoutAt ?? (r.online ? 'online' : ''),
        hms(r.durationSeconds), statusLabel(r.status),
        Math.round(r.lateSeconds / 60), r.logoutReason ?? '', r.ip ?? '', r.userAgent ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
//  Employee self-view.
// ---------------------------------------------------------------------------

export async function employeeAttendance(
  userId: number,
  page = 1,
  pageSize = 30,
) {
  const now = istParts();
  const fresh = istDatetimeMinutesAgo(ONLINE_THRESHOLD_MIN);
  const today = now.date;
  page = Math.max(1, page);
  pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));
  const offset = (page - 1) * pageSize;

  // Today's rollup.
  const todayRow = await queryOne<{
    first_login: string | null;
    last_logout: string | null;
    total_seconds: number;
    online: number;
    first_status: string | null;
  }>(
    `SELECT DATE_FORMAT(MIN(login_at), '%Y-%m-%dT%H:%i:%s') AS first_login,
            DATE_FORMAT(MAX(logout_at), '%Y-%m-%dT%H:%i:%s') AS last_logout,
            COALESCE(SUM(COALESCE(duration_seconds, TIMESTAMPDIFF(SECOND, login_at, ?))), 0) AS total_seconds,
            MAX(CASE WHEN logout_at IS NULL AND last_seen_at >= ? THEN 1 ELSE 0 END) AS online,
            SUBSTRING_INDEX(GROUP_CONCAT(status ORDER BY login_at SEPARATOR '|'), '|', 1) AS first_status
       FROM attendance_sessions
      WHERE user_id = ? AND work_date = ?`,
    [now.datetime, fresh, userId, today],
  );

  // Lifetime punctuality counts.
  const counts = await queryOne<{ on_time: number; grace: number; late: number }>(
    `SELECT SUM(status = 'on_time') AS on_time,
            SUM(status = 'grace')   AS grace,
            SUM(status = 'late')    AS late
       FROM attendance_sessions WHERE user_id = ?`,
    [userId],
  );

  const totalRow = await queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM attendance_sessions WHERE user_id = ?',
    [userId],
  );
  const total = Number(totalRow?.total ?? 0);

  const history = await query<any>(
    `SELECT a.id,
            DATE_FORMAT(a.work_date, '%Y-%m-%d') AS work_date,
            DATE_FORMAT(a.login_at, '%Y-%m-%dT%H:%i:%s') AS login_at,
            DATE_FORMAT(a.logout_at, '%Y-%m-%dT%H:%i:%s') AS logout_at,
            COALESCE(a.duration_seconds, TIMESTAMPDIFF(SECOND, a.login_at, ?)) AS duration_seconds,
            a.status, a.late_seconds, s.name AS shift_name,
            CASE WHEN a.logout_at IS NULL AND a.last_seen_at >= ? THEN 1 ELSE 0 END AS online
       FROM attendance_sessions a
       LEFT JOIN shifts s ON s.id = a.shift_id
      WHERE a.user_id = ?
      ORDER BY a.login_at DESC
      LIMIT ${pageSize} OFFSET ${offset}`,
    [now.datetime, fresh, userId],
  );

  const shift = await queryOne<{ shift_name: string | null; shift_start: string | null }>(
    `SELECT s.name AS shift_name, TIME_FORMAT(s.start_time, '%H:%i') AS shift_start
       FROM users u LEFT JOIN shifts s ON s.id = u.shift_id WHERE u.id = ?`,
    [userId],
  );

  return {
    today: {
      firstLogin: todayRow?.first_login ?? null,
      lastLogout: todayRow?.last_logout ?? null,
      totalSeconds: Number(todayRow?.total_seconds ?? 0),
      online: Number(todayRow?.online ?? 0) === 1,
      status: (todayRow?.first_status && todayRow.first_status.length
        ? todayRow.first_status
        : null) as AttendanceStatus | null,
    },
    shift: {
      name: shift?.shift_name ?? null,
      start: shift?.shift_start ?? null,
    },
    counts: {
      onTime: Number(counts?.on_time ?? 0),
      grace: Number(counts?.grace ?? 0),
      late: Number(counts?.late ?? 0),
    },
    history: history.map((r) => ({
      id: Number(r.id),
      workDate: r.work_date,
      loginAt: r.login_at,
      logoutAt: r.logout_at,
      durationSeconds: Number(r.duration_seconds ?? 0),
      status: r.status as AttendanceStatus | null,
      lateSeconds: Number(r.late_seconds ?? 0),
      shiftName: r.shift_name,
      online: Number(r.online) === 1,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

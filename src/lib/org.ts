import { query } from './db';
import type { AdminUser, TeamSummary } from '@/types';

export interface OrgPerson {
  id: number;
  name: string;
  email: string;
  team_id: number | null;
  reports_to: number | null;
}

/** Every account, with team name - for the Admin user manager. */
export async function listUsers(): Promise<AdminUser[]> {
  return query<AdminUser>(
    `SELECT u.id, u.name, u.email, u.role, u.team_id,
            t.name AS team_name, u.reports_to, u.is_active,
            DATE_FORMAT(u.created_at, '%Y-%m-%d') AS created_at
       FROM users u
       LEFT JOIN teams t ON t.id = u.team_id
      ORDER BY FIELD(u.role, 'admin', 'manager', 'tl', 'employee'), u.name`,
  );
}

/** Every team, with manager and TL names. */
export async function listTeams(): Promise<TeamSummary[]> {
  return query<TeamSummary>(
    `SELECT t.id, t.name, t.manager_id, t.tl_id,
            m.name AS manager_name, l.name AS tl_name
       FROM teams t
       LEFT JOIN users m ON m.id = t.manager_id
       LEFT JOIN users l ON l.id = t.tl_id
      ORDER BY t.name`,
  );
}

/** Team Leads that report to a given manager. */
export async function tlsUnderManager(managerId: number): Promise<OrgPerson[]> {
  return query<OrgPerson>(
    `SELECT id, name, email, team_id, reports_to
       FROM users
      WHERE role = 'tl' AND reports_to = ? AND is_active = 1
      ORDER BY name`,
    [managerId],
  );
}

/** Employees whose team belongs to a given manager. */
export async function employeesUnderManager(managerId: number): Promise<OrgPerson[]> {
  return query<OrgPerson>(
    `SELECT u.id, u.name, u.email, u.team_id, u.reports_to
       FROM users u
       JOIN teams t ON t.id = u.team_id
      WHERE u.role = 'employee' AND t.manager_id = ? AND u.is_active = 1
      ORDER BY u.name`,
    [managerId],
  );
}

/** Employees that report to a given Team Lead. */
export async function employeesUnderTL(tlId: number): Promise<OrgPerson[]> {
  return query<OrgPerson>(
    `SELECT id, name, email, team_id, reports_to
       FROM users
      WHERE role = 'employee' AND reports_to = ? AND is_active = 1
      ORDER BY name`,
    [tlId],
  );
}

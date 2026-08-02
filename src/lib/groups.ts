import { query, queryOne } from './db';
import { employeesUnderTL } from './org';

/**
 * Group-Based Campaign Management — data access + RBAC helpers.
 *
 * A group is a unit of TLs + agents that owns campaigns:
 *   - `groups`           the group itself
 *   - `group_tl`         TLs who run the group
 *   - `group_agents`     agents who belong to the group
 *   - campaigns.group_id nullable owner; NULL = legacy / admin-only campaign
 *
 * Every TL- and agent-facing API must authorize through these helpers —
 * never trust a campaignId/groupId coming from the client.
 */

export interface GroupSummary {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  tls: { id: number; name: string }[];
  agents: { id: number; name: string }[];
  campaign_count: number;
}

/** All groups with their TLs, agents and campaign counts (admin view). */
export async function listGroups(): Promise<GroupSummary[]> {
  const groups = await query<any>(
    `SELECT g.id, g.name, g.description,
            DATE_FORMAT(g.created_at, '%Y-%m-%d') AS created_at,
            COUNT(DISTINCT c.id) AS campaign_count
       FROM \`groups\` g
       LEFT JOIN campaigns c ON c.group_id = g.id
      GROUP BY g.id
      ORDER BY g.name`,
  );
  if (groups.length === 0) return [];

  const ids = groups.map((g: any) => g.id);
  const ph = ids.map(() => '?').join(',');
  const tls = await query<any>(
    `SELECT gt.group_id, u.id, u.name
       FROM group_tl gt JOIN users u ON u.id = gt.tl_id
      WHERE gt.group_id IN (${ph}) ORDER BY u.name`,
    ids,
  );
  const agents = await query<any>(
    `SELECT ga.group_id, u.id, u.name
       FROM group_agents ga JOIN users u ON u.id = ga.agent_id
      WHERE ga.group_id IN (${ph}) ORDER BY u.name`,
    ids,
  );

  return groups.map((g: any) => ({
    ...g,
    tls: tls.filter((t: any) => t.group_id === g.id).map((t: any) => ({ id: t.id, name: t.name })),
    agents: agents.filter((a: any) => a.group_id === g.id).map((a: any) => ({ id: a.id, name: a.name })),
  }));
}

/** Ids of the groups a TL runs. */
export async function groupIdsForTL(tlId: number): Promise<number[]> {
  const rows = await query<{ group_id: number }>(
    'SELECT group_id FROM group_tl WHERE tl_id = ?',
    [tlId],
  );
  return rows.map((r) => r.group_id);
}

/** Ids of the groups an agent belongs to. */
export async function groupIdsForAgent(agentId: number): Promise<number[]> {
  const rows = await query<{ group_id: number }>(
    'SELECT group_id FROM group_agents WHERE agent_id = ?',
    [agentId],
  );
  return rows.map((r) => r.group_id);
}

/** Does this TL run the given group? */
export async function tlOwnsGroup(tlId: number, groupId: number): Promise<boolean> {
  const row = await queryOne(
    'SELECT id FROM group_tl WHERE tl_id = ? AND group_id = ?',
    [tlId, groupId],
  );
  return !!row;
}

/** Does the campaign belong to one of the TL's groups? */
export async function tlOwnsCampaign(tlId: number, campaignId: number): Promise<boolean> {
  const row = await queryOne(
    `SELECT c.id FROM campaigns c
       JOIN group_tl gt ON gt.group_id = c.group_id
      WHERE c.id = ? AND gt.tl_id = ?`,
    [campaignId, tlId],
  );
  return !!row;
}

/**
 * May this agent work the campaign? True only when the campaign belongs
 * to one of the agent's groups — agents are assigned through groups,
 * not individually.
 */
export async function agentCanAccessCampaign(agentId: number, campaignId: number): Promise<boolean> {
  const row = await queryOne(
    `SELECT c.id FROM campaigns c
       JOIN group_agents ga ON ga.group_id = c.group_id AND ga.agent_id = ?
      WHERE c.id = ?`,
    [agentId, campaignId],
  );
  return !!row;
}

/**
 * Replace a group's membership table contents with the selected user ids,
 * validated against the expected role. Runs inside the caller's transaction.
 */
export async function syncGroupMembers(
  conn: any,
  table: 'group_tl' | 'group_agents',
  column: 'tl_id' | 'agent_id',
  role: 'tl' | 'employee',
  groupId: number,
  userIds: number[],
) {
  await conn.execute(`DELETE FROM ${table} WHERE group_id = ?`, [groupId]);
  if (userIds.length === 0) return;

  // Only accept users that actually have the right role.
  const ph = userIds.map(() => '?').join(',');
  const [valid]: any = await conn.execute(
    `SELECT id FROM users WHERE id IN (${ph}) AND role = ? AND is_active = 1`,
    [...userIds, role],
  );
  if (valid.length === 0) return;

  const placeholders = valid.map(() => '(?, ?)').join(', ');
  const vals = valid.flatMap((r: any) => [groupId, r.id]);
  await conn.execute(
    `INSERT IGNORE INTO ${table} (group_id, ${column}) VALUES ${placeholders}`,
    vals,
  );
}

/** The agents in the groups this TL runs (deduped). */
export async function agentsInTLGroups(tlId: number) {
  return query<{ id: number; name: string; email: string; team_id: number | null; reports_to: number | null }>(
    `SELECT DISTINCT u.id, u.name, u.email, u.team_id, u.reports_to
       FROM group_agents ga
       JOIN group_tl gt ON gt.group_id = ga.group_id
       JOIN users u     ON u.id = ga.agent_id
      WHERE gt.tl_id = ? AND u.is_active = 1
      ORDER BY u.name`,
    [tlId],
  );
}

/**
 * Everyone a TL is responsible for: the legacy reporting line
 * (users.reports_to) plus the agents of the TL's groups, deduped.
 * Use this everywhere a TL's "team" is needed (dashboard, breaks, stats).
 */
export async function tlTeam(tlId: number) {
  const [direct, groupAgents] = await Promise.all([
    employeesUnderTL(tlId),
    agentsInTLGroups(tlId),
  ]);
  const seen = new Set(direct.map((e) => e.id));
  return [...direct, ...groupAgents.filter((a) => !seen.has(a.id))];
}

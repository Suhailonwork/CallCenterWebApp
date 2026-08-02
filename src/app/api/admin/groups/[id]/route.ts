import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { query, queryOne, pool } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { syncGroupMembers } from '@/lib/groups';

export const runtime = 'nodejs';

/** GET /api/admin/groups/:id - one group with members and its campaigns. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail('Invalid group id');

  const group = await queryOne<any>(
    `SELECT id, name, description,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS created_at
       FROM \`groups\` WHERE id = ?`,
    [id],
  );
  if (!group) return fail('Group not found', 404);

  const tls = await query<any>(
    `SELECT u.id, u.name, u.email FROM group_tl gt
       JOIN users u ON u.id = gt.tl_id WHERE gt.group_id = ? ORDER BY u.name`,
    [id],
  );
  const agents = await query<any>(
    `SELECT u.id, u.name, u.email FROM group_agents ga
       JOIN users u ON u.id = ga.agent_id WHERE ga.group_id = ? ORDER BY u.name`,
    [id],
  );
  const campaigns = await query<any>(
    `SELECT id, name, status, dialer_type FROM campaigns
      WHERE group_id = ? ORDER BY created_at DESC`,
    [id],
  );

  return ok({ group, tls, agents, campaigns });
}

const patchSchema = z.object({
  name:        z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  tlIds:       z.array(z.number().int().positive()).optional(),
  agentIds:    z.array(z.number().int().positive()).optional(),
});

/** PATCH /api/admin/groups/:id - rename / edit / reassign TLs and agents. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail('Invalid group id');

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid group data');
  const d = parsed.data;

  if (!(await queryOne('SELECT id FROM `groups` WHERE id = ?', [id]))) {
    return fail('Group not found', 404);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (d.name !== undefined) {
      await conn.execute('UPDATE `groups` SET name = ? WHERE id = ?', [d.name.trim(), id]);
    }
    if (d.description !== undefined) {
      await conn.execute('UPDATE `groups` SET description = ? WHERE id = ?', [d.description, id]);
    }
    if (d.tlIds !== undefined) {
      await syncGroupMembers(conn, 'group_tl', 'tl_id', 'tl', id, d.tlIds);
    }
    if (d.agentIds !== undefined) {
      await syncGroupMembers(conn, 'group_agents', 'agent_id', 'employee', id, d.agentIds);
    }

    await logAudit(
      { userId: u.id, action: 'update_group', entity: 'groups', entityId: id, details: d },
      conn,
    );

    await conn.commit();
    return ok({ ok: true });
  } catch (e: any) {
    await conn.rollback();
    if (e?.code === 'ER_DUP_ENTRY') return fail('A group with that name already exists', 409);
    console.error('[admin/groups] update failed:', e);
    return fail('Failed to update group', 500);
  } finally {
    conn.release();
  }
}

/**
 * DELETE /api/admin/groups/:id - remove a group.
 * Campaigns that belonged to it are kept: campaigns.group_id has
 * ON DELETE SET NULL, so they become ungrouped (admin-only) campaigns.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail('Invalid group id');

  const group = await queryOne<any>('SELECT id, name FROM `groups` WHERE id = ?', [id]);
  if (!group) return fail('Group not found', 404);

  await query('DELETE FROM `groups` WHERE id = ?', [id]);
  await logAudit({
    userId: u.id,
    action: 'delete_group',
    entity: 'groups',
    entityId: id,
    details: { name: group.name },
  });
  return ok({ ok: true });
}

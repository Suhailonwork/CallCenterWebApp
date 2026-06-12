import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { query, pool } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { listGroups, syncGroupMembers } from '@/lib/groups';

export const runtime = 'nodejs';

/**
 * GET /api/admin/groups - all groups with TLs / agents / campaign counts,
 * plus the assignable user pools (active TLs and agents) for the UI.
 */
export async function GET() {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const groups = await listGroups();
  const tls = await query<{ id: number; name: string }>(
    "SELECT id, name FROM users WHERE role = 'tl' AND is_active = 1 ORDER BY name",
  );
  const agents = await query<{ id: number; name: string }>(
    "SELECT id, name FROM users WHERE role = 'employee' AND is_active = 1 ORDER BY name",
  );
  return ok({ groups, tls, agents });
}

const createSchema = z.object({
  name:        z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  tlIds:       z.array(z.number().int().positive()).optional().default([]),
  agentIds:    z.array(z.number().int().positive()).optional().default([]),
});

/** POST /api/admin/groups - create a group with optional TLs and agents. */
export async function POST(req: Request) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid group data');
  const d = parsed.data;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [res]: any = await conn.execute(
      'INSERT INTO `groups` (name, description, created_by) VALUES (?,?,?)',
      [d.name.trim(), d.description ?? null, u.id],
    );
    const groupId: number = res.insertId;

    await syncGroupMembers(conn, 'group_tl', 'tl_id', 'tl', groupId, d.tlIds);
    await syncGroupMembers(conn, 'group_agents', 'agent_id', 'employee', groupId, d.agentIds);

    await logAudit(
      {
        userId: u.id,
        action: 'create_group',
        entity: 'groups',
        entityId: groupId,
        details: { name: d.name, tlIds: d.tlIds, agentIds: d.agentIds },
      },
      conn,
    );

    await conn.commit();
    return ok({ id: groupId }, 201);
  } catch (e: any) {
    await conn.rollback();
    if (e?.code === 'ER_DUP_ENTRY') return fail('A group with that name already exists', 409);
    console.error('[admin/groups] create failed:', e);
    return fail('Failed to create group', 500);
  } finally {
    conn.release();
  }
}

import { z } from 'zod';
import { randomBytes } from 'crypto';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool, queryOne } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { listUsers, listTeams } from '@/lib/org';
import { provisionEmployeeEndpoint } from '@/lib/asteriskRealtime';

export const runtime = 'nodejs';

/** A random SIP/WebRTC secret for a new agent endpoint (16 hex chars). */
function generateSipPassword(): string {
  return randomBytes(8).toString('hex');
}

/** GET /api/admin/users - all users + all teams. */
export async function GET() {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;
  return ok({ users: await listUsers(), teams: await listTeams() });
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(['admin', 'manager', 'tl', 'employee']),
  teamId: z.number().int().positive().nullable().optional(),
});

/** POST /api/admin/users - create an account. */
export async function POST(req: Request) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid user data');
  const d = parsed.data;

  if (await queryOne('SELECT id FROM users WHERE email = ?', [d.email])) {
    return fail('A user with that email already exists', 409);
  }

  // Resolve the reporting line from the chosen team + role.
  let teamId: number | null = d.teamId ?? null;
  let reportsTo: number | null = null;
  if (teamId && (d.role === 'employee' || d.role === 'tl')) {
    const team = await queryOne<any>(
      'SELECT manager_id, tl_id FROM teams WHERE id = ?',
      [teamId],
    );
    if (!team) return fail('Selected team not found');
    reportsTo = d.role === 'employee' ? team.tl_id : team.manager_id;
  }
  if (d.role === 'manager') {
    teamId = null;
    reportsTo = u.id;
  }
  if (d.role === 'admin') {
    teamId = null;
    reportsTo = null;
  }

  const hash = await hashPassword(d.password);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [res]: any = await conn.execute(
      `INSERT INTO users (name, email, password_hash, role, team_id, reports_to)
       VALUES (?,?,?,?,?,?)`,
      [d.name, d.email, hash, d.role, teamId, reportsTo],
    );
    const newId = res.insertId;

    let extension: string | null = null;
    let sipPassword: string | null = null;
    if (d.role === 'employee') {
      const [mrows]: any = await conn.execute(
        'SELECT COALESCE(MAX(CAST(sip_extension AS UNSIGNED)), 6000) AS mx FROM employees',
      );
      extension = String(Number(mrows[0].mx) + 1);
      sipPassword = generateSipPassword(); // unique per agent

      await conn.execute(
        `INSERT INTO employees (user_id, sip_extension, sip_password, status)
         VALUES (?,?,?,?)`,
        [newId, extension, sipPassword, 'offline'],
      );

      // PJSIP endpoint usi transaction mein banao. Agar ye fail hua to
      // neeche catch block sab rollback kar dega — adha-adha agent (employees
      // row to ho par SIP endpoint na ho) kabhi nahi banega.
      await provisionEmployeeEndpoint(extension, sipPassword, conn);
    }

    await conn.execute(
      'INSERT INTO audit_logs (user_id, action, entity, entity_id) VALUES (?,?,?,?)',
      [u.id, 'create_user', 'users', newId],
    );
    await conn.commit();

    // sipPassword is returned once so an admin can hand it to the agent if needed;
    // the agent's browser also fetches it automatically via GET /api/employee/sip.
    return ok({ id: newId, extension, sipPassword }, 201);
  } catch (e) {
    await conn.rollback();
    console.error('[admin/users] create failed:', e);
    return fail('Failed to create user', 500);
  } finally {
    conn.release();
  }
}
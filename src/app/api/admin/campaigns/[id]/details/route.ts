import { authenticate, isError, ok, fail } from "@/lib/api";
import { query, queryOne } from "@/lib/db";

export const runtime = "nodejs";

/** GET /api/admin/campaigns/[id]/details — full campaign detail. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const u = await authenticate(["admin"]);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail("Invalid campaign id");

  const campaign = await queryOne<any>(
    `SELECT id, name, description, script, status, dialer_type, recording_enabled,
            DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
       FROM campaigns WHERE id = ?`,
    [id],
  );
  if (!campaign) return fail("Campaign not found", 404);

  const gateways = await query<any>(
    `SELECT g.id, g.name, g.ip, g.port, g.channels, g.status
       FROM campaign_gateways cg
       JOIN gsm_gateways g ON g.id = cg.gateway_id
      WHERE cg.campaign_id = ?`,
    [id],
  );

  const employees = await query<any>(
    `SELECT u.id, u.name, u.role,
            COALESCE(e.status, 'offline') AS status,
            COUNT(c.id)                                  AS calls,
            SUM(c.status IN ('connected','completed'))   AS connected,
            SUM(c.status = 'completed')                  AS success,
            COALESCE(SUM(c.duration_seconds), 0)         AS talk_seconds
       FROM campaign_assignments ca
       JOIN users u      ON u.id = ca.employee_id
       LEFT JOIN employees e ON e.user_id = u.id
       LEFT JOIN calls c ON c.employee_id = u.id AND c.campaign_id = ca.campaign_id
      WHERE ca.campaign_id = ?
      GROUP BY u.id, u.name, u.role, e.status
      ORDER BY u.name`,
    [id],
  );

  const calls = await query<any>(
    `SELECT c.id, c.phone_number, c.contact_name, c.direction, c.status,
            c.duration_seconds, c.recording_url,
            DATE_FORMAT(c.started_at, '%Y-%m-%d %H:%i:%s') AS started_at,
            u.name AS employee_name
       FROM calls c
       LEFT JOIN users u ON u.id = c.employee_id
      WHERE c.campaign_id = ?
      ORDER BY c.id DESC
      LIMIT 500`,
    [id],
  );

  const stats = await queryOne<any>(
    `SELECT COUNT(*)                                AS total_calls,
            SUM(status IN ('connected','completed'))AS connected,
            SUM(status = 'completed')               AS success,
            COALESCE(SUM(duration_seconds), 0)      AS talk_seconds
       FROM calls WHERE campaign_id = ?`,
    [id],
  );

  return ok({
    campaign,
    gateways,
    employees,
    calls,
    stats: stats ?? {
      total_calls: 0,
      connected: 0,
      success: 0,
      talk_seconds: 0,
    },
  });
}

import { z } from "zod";
import { authenticate, isError, ok, fail, type AuthedUser } from "@/lib/api";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { employeesUnderManager } from "@/lib/org";

export const runtime = "nodejs";

/** Employees the caller is allowed to assign (admin: all, manager: their team). */
async function assignableEmployees(user: AuthedUser) {
  if (user.role === "admin") {
    return query<{ id: number; name: string }>(
      "SELECT id, name FROM users WHERE role = 'employee' AND is_active = 1 ORDER BY name",
    );
  }
  const team = await employeesUnderManager(user.id);
  return team.map((e) => ({ id: e.id, name: e.name }));
}

/** GET /api/campaigns/:id/assignments - current assignments + assignable agents. */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const u = await authenticate(["admin", "manager"]);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return fail("Invalid campaign id");

  const employees = await assignableEmployees(u);
  const rows = await query<{ employee_id: number }>(
    "SELECT employee_id FROM campaign_assignments WHERE campaign_id = ?",
    [id],
  );
  return ok({ assigned: rows.map((r) => r.employee_id), employees });
}

const putSchema = z.object({
  employeeIds: z.array(z.number().int().positive()),
});

/** PUT /api/campaigns/:id/assignments - set which agents work this campaign. */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const u = await authenticate(["admin", "manager"]);
  if (isError(u)) return u;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return fail("Invalid campaign id");

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid assignment data");

  // A caller may only change assignments for agents they are allowed to manage.
  const allowed = (await assignableEmployees(u)).map((e) => e.id);
  const selected = parsed.data.employeeIds.filter((eid) =>
    allowed.includes(eid),
  );

  if (allowed.length > 0) {
    const ph = allowed.map(() => "?").join(",");
    await query(
      `DELETE FROM campaign_assignments
        WHERE campaign_id = ? AND employee_id IN (${ph})`,
      [id, ...allowed],
    );
  }
  for (const eid of selected) {
    // Ek agent ek hi campaign mein — pehle is agent ke saare (kisi bhi campaign ke)
    // assignments hatao, phir is campaign mein daalo.
    await query(`DELETE FROM campaign_assignments WHERE employee_id = ?`, [
      eid,
    ]);
    await query(
      `INSERT INTO campaign_assignments (campaign_id, employee_id, assigned_by)
       VALUES (?,?,?)`,
      [id, eid, u.id],
    );
  }
  await logAudit({ userId: u.id, action: "assign_campaign", entity: "campaigns", entityId: id });
  return ok({ ok: true });
}

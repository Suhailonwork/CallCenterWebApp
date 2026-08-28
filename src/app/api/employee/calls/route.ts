import { z } from 'zod';
import { authenticate, isError, ok, fail } from '@/lib/api';
import { pool, query, queryOne } from '@/lib/db';
import { broadcastChange, agentWrapupDone } from '@/lib/realtime';
import { agentCanAccessCampaign } from '@/lib/groups';
import { finalizeLead } from '@/lib/leadWriter';
import { dispositionToStatus, statusToCallStatus, LEAD_STATUS } from '@/lib/leadStatus';
import {
  DISPOSITION_ACTION,
  parseDispositionRules,
  resolveDisposition,
} from '@/lib/dispositionRules';
import { createDialerLog, EVENT } from '@/lib/dialerLog';

export const runtime = 'nodejs';

const CALL_STATUSES = [
  'connected',
  'no_answer',
  'busy',
  'voicemail',
  'failed',
  'wrong_number',
] as const;

const logSchema = z.object({
  phoneNumber: z.string().min(1).max(32),
  contactName: z.string().max(150).nullable().optional(),
  campaignId: z.number().int().positive().nullable().optional(),
  csvDataId: z.number().int().positive().nullable().optional(),
  /** calls.id of the attempt this wrap-up belongs to (sent by the dialer). */
  callId: z.number().int().positive().nullable().optional(),
  /**
   * What the line did. The agent picks it in MANUAL mode only; predictive and
   * ratio wrap-ups omit it (the customer was already connected when the screen
   * popped) and it is derived from the disposition below.
   */
  status: z.enum(CALL_STATUSES).nullable().optional(),
  durationSeconds: z.number().int().min(0).max(86400),
  note: z.string().max(5000).nullable().optional(),
  /** The disposition code (PAID, PTP, TNC…) — `tags` is its historical name. */
  tags: z.string().max(255).nullable().optional(),
  /** The reason picked under that code; it is what the dialing rule keys on. */
  dispositionReason: z.string().max(255).nullable().optional(),
  followUpAt: z.string().max(40).nullable().optional(),
  /** 'agent' keeps the callback for this agent, 'campaign' offers it to anyone. */
  callbackType: z.enum(['agent', 'campaign']).optional(),
});

type CallStatus = (typeof CALL_STATUSES)[number];

/**
 * What the line did, for a wrap-up that did not say — a predictive or ratio
 * call, where the customer was already connected when the screen popped.
 *
 * The disposition is the evidence: a code that rests the lead on NO_ANSWER or
 * BUSY means the agent never got a conversation, and everything else (a
 * promise, a settlement, a wrong number the agent heard) means they did.
 */
function deriveCallStatus(rule: { status?: string | null } | null): CallStatus {
  if (!rule?.status) return 'connected';
  // A booked callback is a conversation, whatever the lead status now reads.
  if (rule.status === LEAD_STATUS.CALLBACK) return 'connected';
  const mapped = statusToCallStatus(rule.status);
  return (CALL_STATUSES as readonly string[]).includes(mapped)
    ? (mapped as CallStatus)
    : 'connected';
}

/**
 * POST /api/employee/calls — save the wrap-up for a finished call.
 *
 * This is the end of the lead lifecycle: it closes the attempt's call-history
 * row, writes the resulting lead status, schedules the redial the disposition
 * rules (or, failing those, the campaign's recycle rules) call for, releases
 * the claim, books any callback and returns the agent to READY.
 *
 * Every dialer mode lands here with the same contract. Manual sends the call
 * status it observed; predictive and ratio send only the disposition and the
 * status is derived — so the lead's future is decided by the same rule in
 * every mode.
 */
export async function POST(req: Request) {
  const user = await authenticate(['employee']);
  if (isError(user)) return user;

  const parsed = logSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid call data');
  const d = parsed.data;
  const duration = d.durationSeconds; // zod-validated integer — safe to inline

  // RBAC: a call may only be logged against a campaign the agent can work.
  if (d.campaignId != null && !(await agentCanAccessCampaign(user.id, d.campaignId))) {
    return fail('You are not assigned to this campaign', 403);
  }

  // RBAC: the lead being updated must also be one the agent can work — an
  // arbitrary csvDataId must not let an agent rewrite another campaign's lead.
  let lead: { id: number; campaign_id: number; list_id: number | null } | null = null;
  if (d.csvDataId != null) {
    const [leadRows]: any = await pool.execute(
      'SELECT id, campaign_id, list_id, assigned_to FROM csv_data WHERE id = ?',
      [d.csvDataId],
    );
    const row = leadRows[0];
    if (!row) return fail('Contact not found', 404);
    const allowed =
      row.assigned_to === user.id || (await agentCanAccessCampaign(user.id, row.campaign_id));
    if (!allowed) return fail("You are not assigned to this contact's campaign", 403);
    lead = { id: row.id, campaign_id: row.campaign_id, list_id: row.list_id };
  }

  // ---- the disposition rule: what this wrap-up means for the lead ----
  const campaignId = d.campaignId ?? lead?.campaign_id ?? null;
  const campaignRules = campaignId
    ? await queryOne<{ dialer_type: string; disposition_rules: unknown }>(
        'SELECT dialer_type, disposition_rules FROM campaigns WHERE id = ?',
        [campaignId],
      )
    : null;

  const rule = resolveDisposition({
    code: d.tags,
    reason: d.dispositionReason,
    overrides: parseDispositionRules(campaignRules?.disposition_rules),
  });

  // Predictive and ratio wrap-ups carry no call status — the customer was
  // already on the line when the screen popped, so the disposition is the only
  // thing the agent judged. Manual sends one and it is taken as observed.
  const status = d.status ?? deriveCallStatus(rule);
  if (!d.status && !rule) {
    return fail('A call status or a disposition is required');
  }

  // A disposition that closes the lead cannot also book a callback — the
  // engine would feed it straight back into the queue and undo the close.
  const closes =
    rule?.action === DISPOSITION_ACTION.CLOSE || rule?.action === DISPOSITION_ACTION.DNC;
  const followUp = !closes && d.followUpAt ? d.followUpAt.replace('T', ' ') : null;
  if (rule?.requires_followup && !followUp) {
    return fail(`"${rule.code}" needs a follow-up date and time`);
  }

  // The status the attempt produces: the rule's, when it names one. The
  // planner applies the same precedence, so the history row and the lead agree.
  const attemptLeadStatus = rule?.status ?? dispositionToStatus(status);

  const log = createDialerLog(pool, { tag: 'WRAPUP' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ---- 1. the call-history row -------------------------------------
    // Every attempt already opened a row (engine for predictive, ARI for
    // manual). Update that one so an attempt is never counted twice; only a
    // dial with no attempt row behind it (a number typed by hand with no
    // lead) inserts a fresh one.
    let callId: number | null = d.callId ?? null;
    if (callId) {
      const [ownRows]: any = await conn.execute(
        'SELECT id FROM calls WHERE id = ? AND (employee_id IS NULL OR employee_id = ?)',
        [callId, user.id],
      );
      if (!ownRows[0]) callId = null;
    }
    if (!callId && d.csvDataId) {
      const [openRows]: any = await conn.execute(
        `SELECT id FROM calls
          WHERE csv_data_id = ? AND disposition IS NULL
            AND created_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
          ORDER BY id DESC LIMIT 1`,
        [d.csvDataId],
      );
      if (openRows[0]) callId = openRows[0].id;
    }

    if (callId) {
      await conn.execute(
        `UPDATE calls
            SET employee_id      = ?,
                campaign_id      = COALESCE(campaign_id, ?),
                csv_data_id      = COALESCE(csv_data_id, ?),
                list_id          = COALESCE(list_id, ?),
                contact_name     = COALESCE(contact_name, ?),
                status              = ?,
                lead_status         = ?,
                disposition         = ?,
                disposition_reason  = ?,
                duration_seconds = GREATEST(duration_seconds, ?),
                answered_at      = CASE WHEN ? = 'connected'
                                        THEN COALESCE(answered_at, DATE_SUB(NOW(), INTERVAL ? SECOND))
                                        ELSE answered_at END,
                ended_at         = COALESCE(ended_at, NOW())
          WHERE id = ?`,
        [
          user.id,
          d.campaignId ?? null,
          d.csvDataId ?? null,
          lead?.list_id ?? null,
          d.contactName ?? null,
          status,
          attemptLeadStatus,
          rule?.code ?? d.tags ?? null,
          rule?.reason ?? d.dispositionReason ?? null,
          duration,
          status,
          duration,
          callId,
        ],
      );
    } else {
      const [callRes]: any = await conn.execute(
        `INSERT INTO calls
           (employee_id, campaign_id, csv_data_id, list_id, phone_number, contact_name,
            direction, dial_source, status, lead_status, disposition, disposition_reason,
            duration_seconds, started_at, answered_at, ended_at)
         VALUES (?,?,?,?,?,?, 'outbound', 'manual', ?, ?, ?, ?, ?,
           DATE_SUB(NOW(), INTERVAL ${duration} SECOND),
           ${status === 'connected' ? `DATE_SUB(NOW(), INTERVAL ${duration} SECOND)` : 'NULL'},
           NOW())`,
        [
          user.id,
          d.campaignId ?? null,
          d.csvDataId ?? null,
          lead?.list_id ?? null,
          d.phoneNumber,
          d.contactName ?? null,
          status,
          attemptLeadStatus,
          rule?.code ?? d.tags ?? null,
          rule?.reason ?? d.dispositionReason ?? null,
          duration,
        ],
      );
      callId = callRes.insertId;
    }

    // Link a pending recording (if any) for this phone number.
    try {
      const [recRows]: any = await conn.execute(
        `SELECT id, filename FROM pending_recordings
          WHERE phone_number = ? AND consumed = 0
          ORDER BY id DESC LIMIT 1`,
        [d.phoneNumber],
      );
      if (recRows[0]) {
        await conn.execute('UPDATE calls SET recording_url = ? WHERE id = ?', [
          recRows[0].filename,
          callId,
        ]);
        await conn.execute('UPDATE pending_recordings SET consumed = 1 WHERE id = ?', [
          recRows[0].id,
        ]);
      }
    } catch (e) {
      console.error('[calls] recording link failed:', e);
    }

    const [noteRes]: any = await conn.execute(
      `INSERT INTO call_notes (call_id, employee_id, note, tags, follow_up_at)
       VALUES (?,?,?,?,?)`,
      [callId, user.id, d.note ?? null, d.tags ?? null, followUp],
    );

    // ---- 2. the callback ---------------------------------------------
    if (followUp) {
      await conn.execute(
        `INSERT INTO scheduled_calls
           (call_note_id, csv_data_id, campaign_id, list_id, phone_number, contact_name,
            scheduled_at, assigned_to, callback_type, status)
         VALUES (?,?,?,?,?,?,?,?,?, 'pending')`,
        [
          noteRes.insertId,
          d.csvDataId ?? null,
          d.campaignId ?? null,
          lead?.list_id ?? null,
          d.phoneNumber,
          d.contactName ?? null,
          followUp,
          user.id,
          d.callbackType ?? 'agent',
        ],
      );
    }

    // ---- 3. the daily performance rollup -----------------------------
    const connected = status === 'connected' ? 1 : 0;
    await conn.execute(
      `INSERT INTO performance
         (employee_id, date, calls_made, calls_connected, total_duration_seconds)
       VALUES (?, CURDATE(), 1, ?, ?)
       ON DUPLICATE KEY UPDATE
         calls_made = calls_made + 1,
         calls_connected = calls_connected + VALUES(calls_connected),
         total_duration_seconds = total_duration_seconds + VALUES(total_duration_seconds)`,
      [user.id, connected, duration],
    );
    await conn.execute(
      `UPDATE performance
          SET success_rate = ROUND(100 * calls_connected / GREATEST(calls_made, 1), 2)
        WHERE employee_id = ? AND date = CURDATE()`,
      [user.id],
    );

    await conn.commit();

    // ---- 4. the lead: status, redial schedule, claim release ---------
    // Outside the transaction on purpose — finalizeLead reads the campaign's
    // rules and must not hold row locks while it does.
    let plan = null;
    if (d.csvDataId) {
      plan = await finalizeLead(pool, {
        leadId: d.csvDataId,
        status: dispositionToStatus(status),
        disposition: rule?.code ?? d.tags ?? undefined,
        // What the agent said outranks what the line did: the rule decides the
        // status the lead rests on, whether it is redialled, when, and how often.
        dispositionRule: rule ?? undefined,
        followUpAt: followUp ?? undefined,
        release: true,
      });

      // The rule may land the lead somewhere else than the attempt row was
      // written with (the attempt cap closing it, say) — keep history honest.
      if (plan && plan.status !== attemptLeadStatus && callId) {
        await pool
          .execute('UPDATE calls SET lead_status = ? WHERE id = ?', [plan.status, callId])
          .catch((e) => console.error('[calls] lead_status sync failed:', e));
      }

      log.log(EVENT.DISPOSITION, {
        leadId: d.csvDataId,
        campaignId: d.campaignId ?? lead?.campaign_id,
        listId: lead?.list_id,
        callId,
        agentId: user.id,
        from: plan?.previousStatus,
        to: plan?.status,
        detail: {
          disposition: rule?.code || d.tags || '-',
          reason: rule?.reason || undefined,
          action: rule?.action || undefined,
          durationSec: duration,
          followUp: followUp || undefined,
        },
      });

      if (plan?.willRetry) {
        log.log(EVENT.RETRY_SCHEDULED, {
          leadId: d.csvDataId,
          campaignId: d.campaignId ?? lead?.campaign_id,
          to: plan.status,
          detail: { at: plan.nextRetryAt, delayMin: plan.delayMin, attempt: plan.callCount },
        });
      } else if (plan?.status === LEAD_STATUS.COMPLETED || plan?.exhausted) {
        log.log(EVENT.COMPLETED, {
          leadId: d.csvDataId,
          campaignId: d.campaignId ?? lead?.campaign_id,
          to: plan.status,
          detail: { reason: plan.reason, attempts: plan.callCount },
        });
      } else {
        log.log(EVENT.RELEASED, {
          leadId: d.csvDataId,
          campaignId: d.campaignId ?? lead?.campaign_id,
          to: plan?.status,
          detail: { reason: plan?.reason },
        });
      }
    }

    // ---- 5. the agent is free again ----------------------------------
    agentWrapupDone(user.id);
    broadcastChange('calls');

    return ok(
      {
        callId,
        callStatus: status,
        disposition: rule?.code ?? null,
        dispositionAction: rule?.action ?? null,
        leadStatus: plan?.status ?? null,
        nextRetryAt: plan?.nextRetryAt ?? null,
        willRetry: plan?.willRetry ?? false,
      },
      201,
    );
  } catch (err) {
    await conn.rollback();
    console.error('[calls] log failed:', err);
    return fail('Failed to save call', 500);
  } finally {
    conn.release();
  }
}

/** GET /api/employee/calls — the employee's 20 most recent calls. */
export async function GET() {
  const user = await authenticate(['employee']);
  if (isError(user)) return user;

  const calls = await query(
    `SELECT id, phone_number, contact_name, status, duration_seconds, created_at
       FROM calls
      WHERE employee_id = ?
      ORDER BY created_at DESC
      LIMIT 20`,
    [user.id],
  );
  return ok({ calls });
}

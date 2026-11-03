import { query, queryOne } from './db';
import { parseNote } from './campaignExport';
import { groupIdsForAgent } from './groups';

/** One past attempt on a customer's number, as the agent's popup shows it. */
export interface HistoryEntry {
  id: number;
  started_at: string | null;
  agent: string | null;
  campaign: string | null;
  status: string;
  duration_seconds: number;
  disposition: string | null;
  reason: string | null;
  note: string | null;
  amount: string | null;
  pay_date: string | null;
  pay_mode: string | null;
  follow_up_at: string | null;
}

export interface CustomerHistoryResult {
  total: number;
  connected: number;
  talk_seconds: number;
  calls: HistoryEntry[];
}

/** The popup is read mid-call: enough to see the pattern, newest first. */
const MAX_ROWS = 200;

/**
 * Everything that happened on this number in the campaigns of the agent's own
 * groups, so one group's notes never reach another group's agents.
 *
 * The call still in progress is left out: it has no outcome yet.
 */
export async function customerHistoryForAgent(
  agentId: number,
  phone: string,
): Promise<CustomerHistoryResult> {
  const empty: CustomerHistoryResult = { total: 0, connected: 0, talk_seconds: 0, calls: [] };
  const groupIds = await groupIdsForAgent(agentId);
  if (groupIds.length === 0) return empty;

  const scope = `c.phone_number = ?
       AND c.campaign_id IN (SELECT id FROM campaigns
                              WHERE group_id IN (${groupIds.map(() => '?').join(',')}))
       AND NOT (c.ended_at IS NULL AND c.status IN ('dialing','ringing','connected'))`;
  const params = [phone, ...groupIds];

  const totals = await queryOne<{ total: number; connected: number | null; talk_seconds: number | null }>(
    `SELECT COUNT(*) AS total,
            SUM(c.status IN ('connected','completed')) AS connected,
            COALESCE(SUM(c.duration_seconds), 0) AS talk_seconds
       FROM calls c
      WHERE ${scope}`,
    params,
  );

  const rows = await query<{
    id: number;
    started_at: string | null;
    agent: string | null;
    campaign: string | null;
    status: string;
    duration_seconds: number;
    disposition: string | null;
    disposition_reason: string | null;
    note: string | null;
    follow_up_at: string | null;
  }>(
    `SELECT c.id,
            DATE_FORMAT(COALESCE(c.started_at, c.created_at), '%Y-%m-%d %H:%i:%s') AS started_at,
            u.name AS agent,
            cmp.name AS campaign,
            c.status,
            c.duration_seconds,
            COALESCE(c.disposition, n.tags) AS disposition,
            c.disposition_reason,
            n.note,
            DATE_FORMAT(n.follow_up_at, '%Y-%m-%d %H:%i') AS follow_up_at
       FROM calls c
       LEFT JOIN users u       ON u.id = c.employee_id
       LEFT JOIN campaigns cmp ON cmp.id = c.campaign_id
       LEFT JOIN call_notes n  ON n.call_id = c.id
      WHERE ${scope}
      ORDER BY c.id DESC, n.id DESC
      LIMIT ${MAX_ROWS}`,
    params,
  );

  return {
    total: Number(totals?.total ?? 0),
    connected: Number(totals?.connected ?? 0),
    talk_seconds: Number(totals?.talk_seconds ?? 0),
    calls: rows.map((r) => {
      const parsed = parseNote(r.note);
      return {
        id: r.id,
        started_at: r.started_at,
        agent: r.agent,
        campaign: r.campaign,
        status: r.status,
        duration_seconds: Number(r.duration_seconds) || 0,
        disposition: r.disposition || parsed.code || null,
        reason: r.disposition_reason || parsed.reason || null,
        note: parsed.text || null,
        amount: parsed.amount || null,
        pay_date: parsed.payDate || null,
        pay_mode: parsed.payMode || null,
        follow_up_at: r.follow_up_at,
      };
    }),
  };
}

import { authenticate, isError, ok } from '@/lib/api';
import { query, queryOne } from '@/lib/db';
import { dialerSnapshot, liveAgentPresence } from '@/lib/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/dashboard-live — everything the Real-Time Dashboard shows.
 *
 * One request that fuses the live engine snapshot (agent state machine, calls
 * on the wire right now) with today's and this week's database counters, so the
 * dashboard polls a single URL. Safe to call when the engine is not in this
 * process: every live figure falls back to the database.
 */
export async function GET() {
  const u = await authenticate(['admin', 'manager']);
  if (isError(u)) return u;

  const snap = dialerSnapshot();

  const [
    inbound,
    outbound,
    topAgents,
    dispositions,
    abandoned,
    leads,
  ] = await Promise.all([
    // Inbound today: answered vs unanswered, plus ringing right now.
    queryOne<any>(
      `SELECT
         COALESCE(SUM(status = 'connected'), 0)                               AS answered,
         COALESCE(SUM(status IN
           ('no_answer','busy','failed','abandoned','cancelled','voicemail')), 0) AS unanswered,
         COALESCE(SUM(status IN ('dialing','ringing')), 0)                    AS ringing
       FROM calls
       WHERE direction = 'inbound'
         AND created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY`,
    ),
    // Outbound today: answered vs unanswered, plus ringing right now.
    queryOne<any>(
      `SELECT
         COALESCE(SUM(status = 'connected'), 0)                               AS answered,
         COALESCE(SUM(status IN
           ('no_answer','busy','failed','abandoned','cancelled','voicemail')), 0) AS unanswered,
         COALESCE(SUM(status IN ('dialing','ringing')), 0)                    AS ringing
       FROM calls
       WHERE direction = 'outbound'
         AND created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY`,
    ),
    // Top agents by call count today.
    query<any>(
      `SELECT u.name, COUNT(c.id) AS calls
         FROM calls c
         JOIN users u ON u.id = c.employee_id
        WHERE c.created_at >= CURDATE() AND c.created_at < CURDATE() + INTERVAL 1 DAY
        GROUP BY c.employee_id, u.name
        ORDER BY calls DESC
        LIMIT 5`,
    ),
    // Disposition breakdown today (agent wrap-up codes).
    query<any>(
      `SELECT disposition AS code, COUNT(*) AS n
         FROM calls
        WHERE created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY
          AND disposition IS NOT NULL AND disposition <> ''
        GROUP BY disposition
        ORDER BY n DESC`,
    ),
    // Abandoned attempts per day over the last 7 days.
    query<any>(
      `SELECT DATE(created_at) AS d,
              COALESCE(SUM(status = 'abandoned'), 0) AS abandoned
         FROM calls
        WHERE created_at >= CURDATE() - INTERVAL 6 DAY
        GROUP BY DATE(created_at)
        ORDER BY d`,
    ),
    // Lead queue totals across every list.
    queryOne<any>(
      `SELECT
         COUNT(*)                                                             AS total,
         COALESCE(SUM(call_status = 'NEW'), 0)                                AS to_be_dialled,
         COALESCE(SUM(call_count > 0), 0)                                     AS dialled,
         COALESCE(SUM(call_status = 'NEW'
                  OR (next_retry_at IS NOT NULL AND next_retry_at <= NOW())), 0) AS queue_now
       FROM csv_data`,
    ),
  ]);

  // ---- Agent status: the live Socket.IO presence registry is authoritative ----
  // These are exactly the employees whose browser holds an open connection right
  // now — an agent is added on connect and dropped on disconnect, so a closed
  // tab or a crash never leaves a ghost "logged in". An empty roster means
  // nobody is on the floor, which is the truth, not a reason to fall back to
  // stale session rows.
  const presence = liveAgentPresence();
  const by = (s: string) => (presence ?? []).filter((a) => a.agentState === s).length;
  const agents = {
    loggedIn: presence?.length ?? 0,
    onCall: by('INCALL'),
    ready: by('READY'),
    pausedWrap: by('PAUSE') + by('WRAPUP'),
    // false only when this route runs outside the live server process.
    live: presence != null,
  };

  // Outbound lines live on the wire right now — the engine is authoritative.
  const liveRinging = snap?.calls
    ? snap.calls.filter((c) => c.state === 'ringing' || c.state === 'dialing').length
    : null;

  const num = (v: any) => Number(v ?? 0);

  return ok({
    asOf: new Date().toISOString(),
    engineRunning: snap != null,
    agents,
    inbound: {
      answered: num(inbound?.answered),
      unanswered: num(inbound?.unanswered),
      ringing: num(inbound?.ringing),
    },
    outbound: {
      answered: num(outbound?.answered),
      unanswered: num(outbound?.unanswered),
      ringing: liveRinging ?? num(outbound?.ringing),
    },
    topAgents: topAgents.map((r: any) => ({ name: r.name, calls: Number(r.calls) })),
    dispositions: dispositions.map((r: any) => ({ code: r.code, n: Number(r.n) })),
    abandoned7d: abandoned.map((r: any) => ({
      date: r.d, // 'YYYY-MM-DD'
      abandoned: Number(r.abandoned),
    })),
    leads: {
      total: num(leads?.total),
      toBeDialled: num(leads?.to_be_dialled),
      dialled: num(leads?.dialled),
      queueNow: num(leads?.queue_now),
    },
  });
}

import { authenticate, isError, ok } from '@/lib/api';
import { query } from '@/lib/db';
import { groupIdsForTL } from '@/lib/groups';
import { dialerSnapshot } from '@/lib/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/tl/dialer/live — the live dialer, scoped to this Team Lead's groups.
 *
 * Same response shape as GET /api/admin/dialer/live so the DialerDashboard
 * component can be shared, but everything is limited to campaigns owned by the
 * groups the TL runs: the live calls, agent states, campaign queues, gateways
 * those campaigns route through, and today's / hourly outcomes. A TL never sees
 * another group's traffic.
 */
export async function GET() {
  const u = await authenticate(['tl']);
  if (isError(u)) return u;

  const groupIds = await groupIdsForTL(u.id);
  const snap = dialerSnapshot();

  // A TL with no groups sees an empty, but well-formed, dashboard.
  if (groupIds.length === 0) {
    return ok({
      engine: {
        running: snap != null,
        enabled: snap?.enabled ?? false,
        ariConnected: snap?.ariConnected ?? false,
        tickMs: snap?.tickMs ?? null,
        activeCalls: 0,
      },
      calls: [],
      agents: [],
      campaigns: [],
      gateways: [],
      today: [],
      hourly: [],
    });
  }

  const gph = groupIds.map(() => '?').join(',');

  const campaigns = await query<any>(
    `SELECT c.id, c.name, c.status, c.dialer_type, c.dial_ratio, c.retry_count,
            c.lead_order, c.max_abandon_pct,
            TIME_FORMAT(c.calling_start, '%H:%i') AS calling_start,
            TIME_FORMAT(c.calling_end,   '%H:%i') AS calling_end,
            COUNT(d.id)                                          AS leads,
            COALESCE(SUM(d.call_status = 'NEW'), 0)              AS fresh,
            COALESCE(SUM(d.next_retry_at IS NOT NULL
                     AND d.next_retry_at > NOW()), 0)            AS waiting_retry,
            COALESCE(SUM(d.call_status IN
              ('QUEUED','DIALING','RINGING','CONNECTED')), 0)    AS in_flight,
            COALESCE(SUM(d.call_status IN
              ('COMPLETED','WRONG_NUMBER','DNC')), 0)            AS finished
       FROM campaigns c
       LEFT JOIN csv_data d ON d.campaign_id = c.id
      WHERE c.status <> 'completed'
        AND c.group_id IN (${gph})
      GROUP BY c.id
      ORDER BY c.name`,
    groupIds,
  );

  // The set of campaigns this TL may see — used to filter the engine's
  // in-memory calls/agents and every DB aggregate below.
  const campaignIds = campaigns.map((c: any) => Number(c.id));
  const allowed = new Set<number>(campaignIds);
  const cph = campaignIds.map(() => '?').join(',');

  const [gateways, today, hourly, queue] = await Promise.all([
    campaignIds.length === 0
      ? Promise.resolve([] as any[])
      : query<any>(
          `SELECT g.id, g.name, g.ip, g.channels, g.status, g.priority, g.reachable,
                  g.fail_count, g.asterisk_endpoint,
                  DATE_FORMAT(g.last_ok_at,   '%Y-%m-%dT%H:%i:%s') AS last_ok_at,
                  DATE_FORMAT(g.last_fail_at, '%Y-%m-%dT%H:%i:%s') AS last_fail_at,
                  COUNT(cl.id)                                          AS calls_today,
                  COALESCE(SUM(cl.status = 'connected'), 0)             AS connected_today
             FROM gsm_gateways g
             JOIN campaign_gateways cg ON cg.gateway_id = g.id AND cg.campaign_id IN (${cph})
             LEFT JOIN calls cl
               ON cl.gateway_id = g.id
              AND cl.campaign_id IN (${cph})
              AND cl.created_at >= CURDATE()
              AND cl.created_at <  CURDATE() + INTERVAL 1 DAY
            GROUP BY g.id
            ORDER BY g.priority DESC, g.name`,
          [...campaignIds, ...campaignIds],
        ),
    campaignIds.length === 0
      ? Promise.resolve([] as any[])
      : query<any>(
          `SELECT lead_status AS status, COUNT(*) AS n
             FROM calls
            WHERE created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY
              AND campaign_id IN (${cph})
            GROUP BY lead_status`,
          campaignIds,
        ),
    campaignIds.length === 0
      ? Promise.resolve([] as any[])
      : query<any>(
          `SELECT HOUR(created_at) AS hour,
                  COUNT(*)                                   AS attempts,
                  COALESCE(SUM(status = 'connected'), 0)     AS connected,
                  COALESCE(SUM(status = 'abandoned'), 0)     AS abandoned,
                  COALESCE(SUM(duration_seconds), 0)         AS talk_seconds
             FROM calls
            WHERE created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY
              AND campaign_id IN (${cph})
            GROUP BY HOUR(created_at)
            ORDER BY hour`,
          campaignIds,
        ),
    campaignIds.length === 0
      ? Promise.resolve([] as any[])
      : query<any>(
          `SELECT s.campaign_id, COUNT(*) AS due_callbacks
             FROM scheduled_calls s
            WHERE s.status = 'pending' AND s.scheduled_at <= NOW()
              AND s.campaign_id IN (${cph})
            GROUP BY s.campaign_id`,
          campaignIds,
        ),
  ]);

  const dueByCampaign = new Map<number, number>(
    queue.map((r: any) => [Number(r.campaign_id), Number(r.due_callbacks)]),
  );
  const liveByCampaign = new Map<number, any>(
    (snap?.campaigns ?? []).map((c) => [c.campaignId, c]),
  );
  const liveByGateway = new Map<number, any>(
    (snap?.gateways ?? []).map((g) => [g.gatewayId, g]),
  );

  // Only the live calls/agents that belong to this TL's campaigns.
  const calls = (snap?.calls ?? []).filter((c) => allowed.has(Number(c.campaignId)));
  const agents = (snap?.agents ?? []).filter(
    (a) => a.campaignId != null && allowed.has(Number(a.campaignId)),
  );

  return ok({
    engine: {
      running: snap != null,
      enabled: snap?.enabled ?? false,
      ariConnected: snap?.ariConnected ?? false,
      tickMs: snap?.tickMs ?? null,
      activeCalls: calls.length,
    },
    calls,
    agents,
    campaigns: campaigns.map((c: any) => {
      const live = liveByCampaign.get(Number(c.id));
      return {
        ...c,
        leads: Number(c.leads),
        fresh: Number(c.fresh),
        waiting_retry: Number(c.waiting_retry),
        in_flight: Number(c.in_flight),
        finished: Number(c.finished),
        due_callbacks: dueByCampaign.get(Number(c.id)) ?? 0,
        live: live?.live ?? 0,
        ready: live?.ready ?? 0,
        incall: live?.incall ?? 0,
        wrapup: live?.wrapup ?? 0,
        pause: live?.pause ?? 0,
        abandon_pct: live?.abandonPct ?? 0,
        paced_by: live?.mode ?? null,
        paced_ratio: live?.pacedRatio ?? null,
        answer_rate: live?.answerRate ?? null,
        avg_handle_sec: live?.avgHandleSec ?? null,
      };
    }),
    gateways: gateways.map((g: any) => {
      const live = liveByGateway.get(Number(g.id));
      return {
        ...g,
        calls_today: Number(g.calls_today),
        connected_today: Number(g.connected_today),
        in_use: live?.inUse ?? 0,
        live_reachable: live?.reachable ?? Number(g.reachable) === 1,
        endpoint_state: live?.state ?? 'unknown',
        cooldown_ms_left: live?.cooldownMsLeft ?? 0,
      };
    }),
    today: today.map((r: any) => ({ status: r.status ?? 'UNKNOWN', count: Number(r.n) })),
    hourly: hourly.map((r: any) => ({
      hour: Number(r.hour),
      attempts: Number(r.attempts),
      connected: Number(r.connected),
      abandoned: Number(r.abandoned),
      talkSeconds: Number(r.talk_seconds),
    })),
  });
}

import { authenticate, isError, ok } from '@/lib/api';
import { query } from '@/lib/db';
import { dialerSnapshot } from '@/lib/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/dialer/live — everything the live dialer dashboard needs.
 *
 * Combines the engine's in-memory state (calls on the wire right now, agent
 * states, gateway channel usage) with the database counters (dialable leads
 * left, today's outcomes), so the page is one request.
 */
export async function GET() {
  const u = await authenticate(['admin', 'manager', 'tl']);
  if (isError(u)) return u;

  const snap = dialerSnapshot();

  const [campaigns, gateways, today, hourly, queue] = await Promise.all([
    query<any>(
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
        GROUP BY c.id
        ORDER BY c.name`,
    ),
    query<any>(
      `SELECT g.id, g.name, g.ip, g.channels, g.status, g.priority, g.reachable,
              g.fail_count, g.asterisk_endpoint,
              DATE_FORMAT(g.last_ok_at,   '%Y-%m-%dT%H:%i:%s') AS last_ok_at,
              DATE_FORMAT(g.last_fail_at, '%Y-%m-%dT%H:%i:%s') AS last_fail_at,
              COUNT(cl.id)                                          AS calls_today,
              COALESCE(SUM(cl.status = 'connected'), 0)             AS connected_today
         FROM gsm_gateways g
         LEFT JOIN calls cl
           ON cl.gateway_id = g.id
          AND cl.created_at >= CURDATE()
          AND cl.created_at <  CURDATE() + INTERVAL 1 DAY
        GROUP BY g.id
        ORDER BY g.priority DESC, g.name`,
    ),
    query<any>(
      `SELECT lead_status AS status, COUNT(*) AS n
         FROM calls
        WHERE created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY
        GROUP BY lead_status`,
    ),
    query<any>(
      `SELECT HOUR(created_at) AS hour,
              COUNT(*)                                   AS attempts,
              COALESCE(SUM(status = 'connected'), 0)     AS connected,
              COALESCE(SUM(status = 'abandoned'), 0)     AS abandoned,
              COALESCE(SUM(duration_seconds), 0)         AS talk_seconds
         FROM calls
        WHERE created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY
        GROUP BY HOUR(created_at)
        ORDER BY hour`,
    ),
    query<any>(
      `SELECT c.id AS campaign_id, COUNT(*) AS due_callbacks
         FROM scheduled_calls s
         JOIN campaigns c ON c.id = s.campaign_id
        WHERE s.status = 'pending' AND s.scheduled_at <= NOW()
        GROUP BY c.id`,
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

  return ok({
    engine: {
      running: snap != null,
      enabled: snap?.enabled ?? false,
      ariConnected: snap?.ariConnected ?? false,
      tickMs: snap?.tickMs ?? null,
      activeCalls: snap?.calls?.length ?? 0,
    },
    calls: snap?.calls ?? [],
    agents: snap?.agents ?? [],
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
        // How this campaign is actually being paced right now. `paced_ratio` is
        // the engine's own figure: for a predictive campaign it is computed and
        // will differ from the configured dial_ratio (which is only a ceiling),
        // and for manual/inbound it stays null because nothing paces them.
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

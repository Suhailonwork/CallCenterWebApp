import { query, queryOne } from '@/lib/db';
import {
  parseDialStatuses,
  parseRecycleRules,
  buildDialableCount,
} from '@/lib/dialEligibility';
import { IN_FLIGHT_STATUSES, TERMINAL_STATUSES, normalizeStatus } from '@/lib/leadStatus';

/**
 * "Why is this campaign not dialing?" — answered with the engine's own
 * predicate, so the number here is exactly the number the dialer sees.
 *
 * Every blocker carries the action that clears it, because the failure mode is
 * always the same: an operator ticks a status in Dial rules and expects leads
 * that were already called to start dialing again. They will not — dial
 * statuses select FRESH leads; a recycle rule or a list RESET is what brings a
 * called lead back.
 */

export interface DialerBlocker {
  reason: string;
  count: number;
  detail: string;
  /** What the operator should do about it. */
  action: 'reset' | 'add-recycle-rule' | 'raise-cap' | 'tick-status' | 'wait' | 'none';
}

export interface DialableReport {
  campaignId: number;
  campaignName: string;
  campaignStatus: string;
  dialerType: string;
  /** Leads the dialer could claim this instant. */
  dialable: number;
  totalLeads: number;
  dialStatuses: string[];
  recycleStatuses: string[];
  maxAttempts: number;
  activeLists: { id: number; name: string; leads: number }[];
  inactiveLists: { id: number; name: string; leads: number }[];
  gateways: { id: number; name: string; usable: boolean; reason: string | null }[];
  blockers: DialerBlocker[];
}

export async function dialableReport(campaignId: number): Promise<DialableReport | null> {
  const campaign = await queryOne<any>(
    `SELECT id, name, status, dialer_type, dial_statuses, recycle_rules,
            retry_count, retry_delay_minutes, lead_order
       FROM campaigns WHERE id = ?`,
    [campaignId],
  );
  if (!campaign) return null;

  const dialStatuses = parseDialStatuses(campaign.dial_statuses);
  const recycleRules = parseRecycleRules(campaign.recycle_rules, campaign.retry_delay_minutes);
  const recycleStatuses = recycleRules.map((r: { status: string }) => r.status);
  const maxAttempts = Number(campaign.retry_count) || 0;

  const lists = await query<{ id: number; name: string; active: 'Y' | 'N'; leads: number }>(
    `SELECT l.id, l.name, l.active, COUNT(d.id) AS leads
       FROM lists l LEFT JOIN csv_data d ON d.list_id = l.id
      WHERE l.campaign_id = ?
      GROUP BY l.id ORDER BY l.name`,
    [campaignId],
  );
  const activeLists = lists.filter((l) => l.active === 'Y').map((l) => ({
    id: l.id,
    name: l.name,
    leads: Number(l.leads),
  }));
  const inactiveLists = lists.filter((l) => l.active === 'N').map((l) => ({
    id: l.id,
    name: l.name,
    leads: Number(l.leads),
  }));

  const gatewayRows = await query<any>(
    `SELECT g.id, g.name, g.status, g.reachable, g.asterisk_endpoint
       FROM campaign_gateways cg JOIN gsm_gateways g ON g.id = cg.gateway_id
      WHERE cg.campaign_id = ?`,
    [campaignId],
  );
  const gateways = gatewayRows.map((g) => {
    let reason: string | null = null;
    if (g.status !== 'active') reason = 'gateway is inactive';
    else if (!g.asterisk_endpoint) reason = 'not provisioned in Asterisk';
    else if (Number(g.reachable) === 0) reason = 'Asterisk reports it offline';
    return { id: g.id, name: g.name, usable: reason === null, reason };
  });

  const blockers: DialerBlocker[] = [];

  if (campaign.status !== 'active') {
    blockers.push({
      reason: 'Campaign is not active',
      count: 0,
      detail: `Status is "${campaign.status}".`,
      action: 'none',
    });
  }
  if (activeLists.length === 0) {
    blockers.push({
      reason: 'No list is switched ON',
      count: 0,
      detail:
        inactiveLists.length > 0
          ? `${inactiveLists.length} list(s) exist but are OFF — switch one ON from the Lists page.`
          : 'This campaign has no lists at all. Upload a CSV first.',
      action: 'none',
    });
  }
  if (gateways.length === 0) {
    blockers.push({
      reason: 'No gateway assigned',
      count: 0,
      detail: 'Assign one under "Edit gateways".',
      action: 'none',
    });
  } else if (gateways.every((g) => !g.usable)) {
    blockers.push({
      reason: 'No usable gateway',
      count: 0,
      detail: gateways.map((g) => `${g.name}: ${g.reason}`).join('; '),
      action: 'none',
    });
  }

  const listIds = activeLists.map((l) => l.id);
  if (listIds.length === 0) {
    return {
      campaignId,
      campaignName: campaign.name,
      campaignStatus: campaign.status,
      dialerType: campaign.dialer_type,
      dialable: 0,
      totalLeads: 0,
      dialStatuses,
      recycleStatuses,
      maxAttempts,
      activeLists,
      inactiveLists,
      gateways,
      blockers,
    };
  }

  // The engine's own predicate — this is the authoritative number.
  let dialable = 0;
  const counter = buildDialableCount({
    campaignId,
    listIds,
    dialStatuses,
    recycleRules,
    claimTimeoutSec: 120,
    maxAttempts,
    leadOrder: campaign.lead_order,
  });
  if (counter) {
    const r = await queryOne<{ n: number }>(counter.sql, counter.params);
    dialable = Number(r?.n ?? 0);
  } else {
    blockers.push({
      reason: 'Nothing is configured to dial',
      count: 0,
      detail: 'No dial statuses are ticked and there are no recycle rules.',
      action: 'tick-status',
    });
  }

  const ph = listIds.map(() => '?').join(',');
  const inFlight = IN_FLIGHT_STATUSES.map(() => '?').join(',');
  const terminal = TERMINAL_STATUSES.map(() => '?').join(',');
  const ruleList = recycleStatuses.length > 0 ? recycleStatuses.map(() => '?').join(',') : "''";
  const dialList = dialStatuses.length > 0 ? dialStatuses.map(() => '?').join(',') : "''";

  // Classified in the same precedence the claim query applies, so the buckets
  // add up against `dialable` instead of double-counting.
  const buckets = await queryOne<any>(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(claimed_at IS NOT NULL AND call_status IN (${inFlight})), 0) AS in_flight,
       COALESCE(SUM(call_status IN (${terminal})), 0)                            AS terminal,
       COALESCE(SUM(? > 0 AND call_count >= ?), 0)                               AS cap_reached,
       COALESCE(SUM(next_retry_at IS NOT NULL AND next_retry_at > NOW()), 0)     AS waiting_retry,
       COALESCE(SUM(called = 1 AND call_status NOT IN (${ruleList})
                    AND call_status NOT IN (${terminal})), 0)                    AS called_no_rule,
       COALESCE(SUM(called = 1 AND call_status IN (${ruleList})), 0)             AS called_with_rule,
       COALESCE(SUM(called = 0 AND call_status NOT IN (${dialList})
                    AND call_status <> 'CALLBACK'), 0)                           AS fresh_not_ticked
       FROM csv_data
      WHERE campaign_id = ? AND list_id IN (${ph})`,
    [
      ...IN_FLIGHT_STATUSES,
      ...TERMINAL_STATUSES,
      maxAttempts,
      maxAttempts,
      ...recycleStatuses,
      ...TERMINAL_STATUSES,
      ...recycleStatuses,
      ...dialStatuses,
      campaignId,
      ...listIds,
    ],
  );

  const totalLeads = Number(buckets?.total ?? 0);
  const n = (k: string) => Number(buckets?.[k] ?? 0);

  if (dialable === 0 && totalLeads > 0) {
    if (n('called_no_rule') > 0) {
      blockers.push({
        reason: 'Already called, and their status has no recycle rule',
        count: n('called_no_rule'),
        detail:
          `Ticking a status under "Dial statuses" does not re-dial a lead that ` +
          `has already been called. Either add a recycle rule for its status, ` +
          `or RESET the list to make every lead fresh again.`,
        action: 'add-recycle-rule',
      });
    }
    if (n('cap_reached') > 0) {
      blockers.push({
        reason: `Attempt cap reached (max ${maxAttempts} per lead)`,
        count: n('cap_reached'),
        detail: 'Raise "Max attempts per lead" (0 = unlimited), or RESET the list.',
        action: 'raise-cap',
      });
    }
    if (n('waiting_retry') > 0) {
      blockers.push({
        reason: 'Waiting for their retry timer',
        count: n('waiting_retry'),
        detail: 'These will dial themselves when the recycle delay elapses.',
        action: 'wait',
      });
    }
    if (n('called_with_rule') > 0 && n('waiting_retry') === 0) {
      blockers.push({
        reason: 'Recycle attempts exhausted',
        count: n('called_with_rule'),
        detail: 'Raise the rule\'s "tries", or RESET the list.',
        action: 'reset',
      });
    }
    if (n('fresh_not_ticked') > 0) {
      blockers.push({
        reason: 'Status is not ticked under Dial statuses',
        count: n('fresh_not_ticked'),
        detail: 'These leads have never been called — tick their status above.',
        action: 'tick-status',
      });
    }
    if (n('in_flight') > 0) {
      blockers.push({
        reason: 'On a call right now',
        count: n('in_flight'),
        detail: 'Nothing to do — these are live.',
        action: 'none',
      });
    }
    if (n('terminal') > 0) {
      blockers.push({
        reason: 'Closed for good',
        count: n('terminal'),
        detail: 'Completed / Wrong Number / DNC. Only a RESET revives them.',
        action: 'reset',
      });
    }
  }

  return {
    campaignId,
    campaignName: campaign.name,
    campaignStatus: campaign.status,
    dialerType: campaign.dialer_type,
    dialable,
    totalLeads,
    dialStatuses,
    recycleStatuses,
    maxAttempts,
    activeLists,
    inactiveLists,
    gateways,
    blockers,
  };
}

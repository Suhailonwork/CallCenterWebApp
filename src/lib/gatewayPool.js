/* =====================================================================
 *  gatewayPool.js — multi-gateway routing for the dialer.
 *
 *  Responsibilities (requirement 10):
 *    · multiple gateways per campaign
 *    · load balancing across them
 *    · a hard cap of concurrent channels per gateway (gsm_gateways.channels)
 *    · automatic failover — a failing gateway is skipped and the call moves
 *      to the next one
 *    · offline gateways are skipped entirely (live ARI endpoint state)
 *
 *  Selection order: highest priority first, then the least-loaded gateway
 *  (by fraction of its channels in use), then the one with the fewest recent
 *  failures. A gateway that fails `failThreshold` times in a row is put in a
 *  cooldown and skipped until it expires or it answers a health check.
 *
 *  CommonJS — required by predictive-engine.js.
 * ===================================================================== */
"use strict";

/**
 * @param {object} o
 * @param {{query:Function}} o.db
 * @param {{info:Function,warn:Function,error:Function,log:Function}} o.log
 * @param {{listEndpoints?:Function}} [o.ari]
 * @param {() => {failThreshold:number, cooldownSec:number, healthSec:number}} o.config
 */
function createGatewayPool({ db, log, ari, config }) {
  /** gatewayId -> live channel count held by this process. */
  const inUse = new Map();
  /** gatewayId -> { failures, cooldownUntil, reachable, state } */
  const health = new Map();
  /** campaignId -> { at, rows } — campaign→gateway mapping cache. */
  const campaignCache = new Map();
  const CAMPAIGN_CACHE_MS = 10_000;

  let healthTimer = null;

  const cfg = () => {
    const c = (config && config()) || {};
    return {
      failThreshold: Math.max(1, Number(c.failThreshold) || 3),
      cooldownSec: Math.max(5, Number(c.cooldownSec) || 60),
      healthSec: Math.max(5, Number(c.healthSec) || 20),
    };
  };

  function stateOf(id) {
    let h = health.get(id);
    if (!h) {
      h = { failures: 0, cooldownUntil: 0, reachable: true, state: "unknown" };
      health.set(id, h);
    }
    return h;
  }

  /** Gateways assigned to a campaign, active and provisioned, freshly cached. */
  async function gatewaysForCampaign(campaignId) {
    const hit = campaignCache.get(campaignId);
    if (hit && Date.now() - hit.at < CAMPAIGN_CACHE_MS) return hit.rows;

    const [rows] = await db.query(
      `SELECT g.id, g.name, g.asterisk_endpoint AS endpoint,
              g.channels, g.priority, g.reachable
         FROM campaign_gateways cg
         JOIN gsm_gateways g ON g.id = cg.gateway_id
        WHERE cg.campaign_id = ?
          AND g.status = 'active'
          AND g.asterisk_endpoint IS NOT NULL
          AND g.asterisk_endpoint <> ''
        ORDER BY g.priority DESC, g.id ASC`,
      [campaignId],
    );
    campaignCache.set(campaignId, { at: Date.now(), rows });
    return rows;
  }

  /** Capacity of one gateway; channels <= 0 means "no local limit". */
  function capacityOf(gw) {
    const ch = Number(gw.channels) || 0;
    return ch > 0 ? ch : Infinity;
  }

  function loadOf(gw) {
    const used = inUse.get(gw.id) || 0;
    const cap = capacityOf(gw);
    return cap === Infinity ? used / 1000 : used / cap;
  }

  /**
   * Pick the best gateway for one attempt and take a channel on it.
   * The caller MUST call release(id) when the attempt finishes.
   *
   * @param {number} campaignId
   * @param {number[]} [excludeIds] gateways already tried for this contact
   * @returns {Promise<{id:number,name:string,endpoint:string}|null>}
   */
  async function acquire(campaignId, excludeIds) {
    const exclude = new Set(excludeIds || []);
    let rows;
    try {
      rows = await gatewaysForCampaign(campaignId);
    } catch (e) {
      log.error("gateway lookup failed", e, { campaign: campaignId });
      return null;
    }
    if (!rows.length) return null;

    const now = Date.now();
    const candidates = rows.filter((gw) => {
      if (exclude.has(gw.id)) return false;
      const h = stateOf(gw.id);
      if (h.cooldownUntil > now) return false;
      if (!h.reachable) return false;
      if (Number(gw.reachable) === 0) return false; // admin/health marked it down
      return (inUse.get(gw.id) || 0) < capacityOf(gw);
    });
    if (!candidates.length) return null;

    candidates.sort((a, b) => {
      if (b.priority !== a.priority) return Number(b.priority) - Number(a.priority);
      const la = loadOf(a);
      const lb = loadOf(b);
      if (la !== lb) return la - lb;
      return stateOf(a.id).failures - stateOf(b.id).failures;
    });

    const gw = candidates[0];
    inUse.set(gw.id, (inUse.get(gw.id) || 0) + 1);
    return { id: gw.id, name: gw.name, endpoint: gw.endpoint };
  }

  /** Give a channel back. Safe to call twice — the counter never goes negative. */
  function release(gatewayId) {
    if (gatewayId == null) return;
    const n = inUse.get(gatewayId) || 0;
    if (n <= 1) inUse.delete(gatewayId);
    else inUse.set(gatewayId, n - 1);
  }

  /** The gateway carried a call — clear its failure streak. */
  function reportSuccess(gatewayId) {
    if (gatewayId == null) return;
    const h = stateOf(gatewayId);
    if (h.failures > 0 || h.cooldownUntil) {
      h.failures = 0;
      h.cooldownUntil = 0;
      log.log("gateway_up", { gatewayId, detail: { reason: "call-succeeded" } });
    }
    db.query(
      "UPDATE gsm_gateways SET last_ok_at = NOW(), fail_count = 0, reachable = 1 WHERE id = ?",
      [gatewayId],
    ).catch(() => {});
  }

  /**
   * The gateway could not carry a call. After failThreshold consecutive
   * failures it is taken out of rotation for cooldownSec — the next attempt
   * automatically moves to another gateway.
   */
  function reportFailure(gatewayId, reason) {
    if (gatewayId == null) return;
    const { failThreshold, cooldownSec } = cfg();
    const h = stateOf(gatewayId);
    h.failures += 1;
    if (h.failures >= failThreshold) {
      h.cooldownUntil = Date.now() + cooldownSec * 1000;
      log.log("gateway_down", {
        gatewayId,
        detail: { failures: h.failures, cooldownSec, reason: reason || "originate-failed" },
      });
    }
    db.query(
      `UPDATE gsm_gateways
          SET last_fail_at = NOW(), fail_count = fail_count + 1,
              reachable = IF(? >= ?, 0, reachable)
        WHERE id = ?`,
      [h.failures, failThreshold, gatewayId],
    ).catch(() => {});
  }

  /**
   * Poll Asterisk for endpoint state and mark gateways offline/online.
   * GSM gateways frequently ignore SIP OPTIONS, so only an EXPLICIT 'offline'
   * counts as down — 'unknown' stays usable (same rule the admin UI uses).
   */
  async function checkHealth() {
    if (!ari || typeof ari.listEndpoints !== "function") return;
    let endpoints;
    try {
      endpoints = await ari.listEndpoints();
    } catch (e) {
      return; // ARI down: the engine already pauses; do not flap gateway state
    }
    if (!Array.isArray(endpoints)) return;

    const byResource = new Map();
    for (const ep of endpoints) {
      if (ep && ep.resource) byResource.set(String(ep.resource), String(ep.state || "unknown"));
    }

    let rows;
    try {
      const [r] = await db.query(
        "SELECT id, name, asterisk_endpoint AS endpoint, reachable FROM gsm_gateways WHERE status = 'active'",
      );
      rows = r;
    } catch {
      return;
    }

    for (const gw of rows) {
      if (!gw.endpoint) continue;
      const state = byResource.has(gw.endpoint) ? byResource.get(gw.endpoint) : "missing";
      // 'missing' means the endpoint is not provisioned in Asterisk at all.
      const reachable = state !== "offline" && state !== "missing";
      const h = stateOf(gw.id);
      const changed = h.reachable !== reachable;
      h.reachable = reachable;
      h.state = state;
      if (reachable) {
        h.failures = 0;
        h.cooldownUntil = 0;
      }
      if (changed) {
        log.log(reachable ? "gateway_up" : "gateway_down", {
          gatewayId: gw.id,
          detail: { name: gw.name, endpoint: gw.endpoint, state },
        });
      }
      if (Number(gw.reachable) !== (reachable ? 1 : 0)) {
        db.query("UPDATE gsm_gateways SET reachable = ? WHERE id = ?", [
          reachable ? 1 : 0,
          gw.id,
        ]).catch(() => {});
      }
    }
  }

  /** Snapshot for the live dashboard. */
  function snapshot() {
    const out = [];
    for (const [id, h] of health) {
      out.push({
        gatewayId: id,
        inUse: inUse.get(id) || 0,
        reachable: h.reachable,
        state: h.state,
        failures: h.failures,
        cooldownMsLeft: Math.max(0, h.cooldownUntil - Date.now()),
      });
    }
    for (const [id, n] of inUse) {
      if (!health.has(id)) out.push({ gatewayId: id, inUse: n, reachable: true, state: "unknown", failures: 0, cooldownMsLeft: 0 });
    }
    return out;
  }

  /** Total channels this process holds on a campaign's gateways. */
  async function inUseForCampaign(campaignId) {
    const rows = await gatewaysForCampaign(campaignId).catch(() => []);
    let n = 0;
    for (const gw of rows) n += inUse.get(gw.id) || 0;
    return n;
  }

  /** Free channels left across a campaign's gateways (Infinity when uncapped). */
  async function capacityForCampaign(campaignId) {
    const rows = await gatewaysForCampaign(campaignId).catch(() => []);
    const now = Date.now();
    let free = 0;
    for (const gw of rows) {
      const h = stateOf(gw.id);
      if (h.cooldownUntil > now || !h.reachable || Number(gw.reachable) === 0) continue;
      const cap = capacityOf(gw);
      if (cap === Infinity) return Infinity;
      free += Math.max(0, cap - (inUse.get(gw.id) || 0));
    }
    return free;
  }

  function start() {
    if (healthTimer) return;
    checkHealth().catch(() => {});
    healthTimer = setInterval(() => {
      checkHealth().catch(() => {});
    }, cfg().healthSec * 1000);
    if (typeof healthTimer.unref === "function") healthTimer.unref();
  }

  function stop() {
    if (healthTimer) clearInterval(healthTimer);
    healthTimer = null;
  }

  /** Drop cached campaign→gateway rows (called after a campaign edit). */
  function invalidate() {
    campaignCache.clear();
  }

  return {
    acquire,
    release,
    reportSuccess,
    reportFailure,
    checkHealth,
    gatewaysForCampaign,
    inUseForCampaign,
    capacityForCampaign,
    snapshot,
    invalidate,
    start,
    stop,
  };
}

module.exports = { createGatewayPool };

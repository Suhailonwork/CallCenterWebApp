/* =====================================================================
 *  predictive-engine.js  —  Phase 1 (agent-decoupled power dialer)
 *
 *  Server HI calls originate karta hai (ARI ke through). Agent ko
 *  dialing / ringing kuch nahi dikhti — sirf CONNECTED call uske
 *  screen pe pop hoti hai. RATIO = 1 (har free agent ke liye 1 call).
 *
 *  Phase 2 TODO:
 *    - RATIO > 1 (over-dial)  -> linesToOpen = ceil(free * RATIO) - inFlight
 *    - AMD (machine detect)   -> machine pe drop, sirf human assign
 *    - abandon-rate cap (~3%) -> ratio auto-adjust (compliance)
 * ===================================================================== */
"use strict";

const mysql = require("mysql2/promise");

/**
 * @param io     Socket.IO server (server.mjs se)
 * @param agents Map<userId, {id,name,role,state,available,extension,campaignId}>
 * @param ari    startAri() ka return: { originatePredictive, setHandlers }
 */
module.exports = function startPredictiveEngine({ io, agents, ari }) {
  const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });
  console.log("[engine] predictive engine started");

  const TICK_MS = 1500;
  // agentId -> true : ek call originate ho chuki, agent abhi "reserved" hai
  const inFlight = new Map();

  // ---- is campaign ka pehla active gateway ----
  async function gatewayForCampaign(campaignId) {
    const [rows] = await db.query(
      `SELECT g.asterisk_endpoint AS endpoint
         FROM campaign_gateways cg
         JOIN gsm_gateways g ON g.id = cg.gateway_id
        WHERE cg.campaign_id = ? AND g.status = 'active'
        LIMIT 1`,
      [campaignId],
    );
    return rows[0] ? rows[0].endpoint : null;
  }

  // ---- agla un-called contact claim karo (FIFO + lock, same as dialer/next) ----
  async function claimNextContact(campaignId, agentId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute(
        `SELECT id, phone_number, name, email, company, custom_fields
           FROM csv_data
          WHERE campaign_id = ? AND called = 0
            AND (claimed_at IS NULL
                 OR claimed_at < DATE_SUB(NOW(), INTERVAL 2 MINUTE))
          ORDER BY id ASC
          LIMIT 1
          FOR UPDATE`,
        [campaignId],
      );
      const c = rows[0];
      if (!c) {
        await conn.commit();
        return null;
      }
      await conn.execute(
        "UPDATE csv_data SET claimed_at = NOW(), assigned_to = ? WHERE id = ?",
        [agentId, c.id],
      );
      await conn.commit();
      return c;
    } catch (e) {
      await conn.rollback();
      console.error("[engine] claim failed:", e && e.message);
      return null;
    } finally {
      conn.release();
    }
  }

  // ---- ek agent ke liye ek call throw karo ----
  async function dialForAgent(agent) {
    console.log(
  "[engine] dialing",
  agent.id,
  agent.extension,
  agent.campaignId
);
    inFlight.set(agent.id, true); // reserve pehle, taaki double-dial na ho
    try {
      const gateway = await gatewayForCampaign(agent.campaignId);
      if (!gateway) {
        inFlight.delete(agent.id);
        return;
      }
      const contact = await claimNextContact(agent.campaignId, agent.id);
      if (!contact) {
        inFlight.delete(agent.id); // is campaign ke contacts khatam
        return;
      }
      await ari.originatePredictive({
        campaignId: agent.campaignId,
        agentId: agent.id,
        agentExt: agent.extension,
        contact,
        gateway,
      });
      // aage ari-app handle karega: answer -> onConnect, fail -> onFailed
    } catch (e) {
      console.error("[engine] dial failed:", e && e.message);
      inFlight.delete(agent.id);
    }
  }

  // ---- main pacing loop (Phase 1: RATIO = 1) ----
  async function tick() {
    for (const agent of agents.values()) {
      if (agent.role !== "employee") continue;
      if (!agent.available) continue; // break / logged-off
      if (agent.state === "on-call") continue; // pehle se call pe
      if (!agent.campaignId || !agent.extension) continue;
      if (inFlight.has(agent.id)) continue; // pehle se ek call ja chuki
      await dialForAgent(agent);
    }
  }
  const timer = setInterval(() => {
    tick().catch(() => {});
  }, TICK_MS);

  // ---- ari-app in dono ko call karega ----

  // Human ne uthaya + agent leg bridge ho gaya -> screen pop
  function onConnect(agentId, contact) {
    inFlight.delete(agentId); // ab on-call hai, reserved nahi
    const a = agents.get(agentId);
    if (a) a.state = "on-call";
    io.to("agent:" + agentId).emit("assigned-call", contact);
  }

  // No answer / busy / agent ne nahi uthaya -> reserve hatao, next tick redial
  function onFailed(agentId /*, contact, cause */) {
    inFlight.delete(agentId);
  }

  return { onConnect, onFailed, stop: () => clearInterval(timer) };
};
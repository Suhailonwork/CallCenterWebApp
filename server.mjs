/* =====================================================================
 *  server.mjs — one process hosting Next.js, the Socket.IO real-time layer,
 *  the Asterisk ARI call control and the predictive dialer engine.
 *
 *  Socket.IO is also where the agent state machine lives: the browser reports
 *  what the agent is doing, the registry turns that into READY / INCALL /
 *  WRAPUP / PAUSE / LOGOUT, and the dialer paces against it.
 * ===================================================================== */

import { createServer } from "node:https";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { jwtVerify } from "jose";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const startAri = require("./ari-app.js");
const startPredictiveEngine = require("./predictive-engine.js");
const { createAgentRegistry, AGENT_STATE } = require("./src/lib/agentRegistry.js");
const { createDialerLog } = require("./src/lib/dialerLog.js");
const { labelFor } = require("./src/lib/dialerModes.js");

const here = dirname(fileURLToPath(import.meta.url));

/** Load .env so JWT_SECRET and the DB/ARI settings are available. */
function loadEnv() {
  try {
    const txt = readFileSync(join(here, ".env"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* ignore — rely on the real environment */
  }
}
loadEnv();

const dev = !process.argv.includes("prod");
const port = Number(process.env.PORT || 3000);
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-insecure-secret-change-me",
);

/** Identify the user behind a socket from its session cookie. */
async function userFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const part = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("cc_token="));
  if (!part) return null;
  try {
    const token = decodeURIComponent(part.slice("cc_token=".length));
    const { payload } = await jwtVerify(token, secret);
    return {
      id: Number(payload.sub),
      name: String(payload.name ?? ""),
      role: String(payload.role ?? ""),
    };
  } catch {
    return null;
  }
}

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(
    {
      key: readFileSync(process.env.TLS_KEY),
      cert: readFileSync(process.env.TLS_CERT),
    },
    (req, res) => handle(req, res),
  );
  const io = new SocketServer(server, { path: "/socket.io" });

  // Expose io so Next.js API routes can broadcast (see src/lib/realtime.ts).
  globalThis.__ccio = io;

  const log = createDialerLog(null, { tag: "AGENTS", toDb: false });
  const registry = createAgentRegistry({ io, log });

  /**
   * May this agent enter the pacing pool for the campaign they named?
   *
   * READY is a promise the server makes to itself — "open lines for this
   * seat" — so it is only legal on a mode the server dials for (predictive
   * or ratio). Manual and inbound agents are parked in PAUSE and told why,
   * which keeps a hand-crafted socket message from turning a manual campaign
   * into a dialable one. Every path that can reach READY goes through here.
   */
  async function allowReady(socket, user, info) {
    const campaignId = info && info.campaignId;
    const engineDriven = await engine.campaignIsEngineDriven(campaignId).catch(() => false);
    if (engineDriven) return true;

    const mode = await engine.campaignMode(campaignId).catch(() => null);
    registry.setState(user.id, AGENT_STATE.PAUSE, {
      extension: info && info.extension,
      campaignId,
      reason: "mode-not-engine-driven",
    });
    socket.emit("dialer-mode-changed", {
      campaignId,
      dialerType: mode,
      reason:
        mode === null
          ? "That campaign is not available for auto-dialing."
          : `${labelFor(mode)} campaigns are dialled by the agent — the ` +
            `auto-dialer does not open lines for them.`,
    });
    log.info("ready refused", { agent: user.id, campaign: campaignId, mode });
    return false;
  }

  io.on("connection", async (socket) => {
    const user = await userFromCookie(socket.handshake.headers.cookie);
    socket.data.user = user;

    if (user && user.role === "employee") {
      registry.connect(user);
      socket.join("agent:" + user.id); // targeted screen pops
    }
    socket.emit("agents-updated", registry.snapshot());

    /**
     * Legacy state report from the existing Dialer component.
     * Crucially, "idle" arriving while the agent is INCALL means the call just
     * ended — that maps to WRAPUP, never straight back to READY, so the dialer
     * cannot drop a new customer on an open wrap-up form.
     */
    socket.on("set-state", (state) => {
      const u = socket.data.user;
      if (u && u.role === "employee") registry.applyLegacyState(u.id, state);
    });

    /**
     * Agent joined the dialing pool ("Go available" / wrap-up saved).
     *
     * READY means "the server may open a line for me", so it is only a legal
     * state on a campaign the server actually dials for. A manual or inbound
     * campaign is refused here rather than in the browser: the UI already
     * hides the button, and this is what makes that a rule instead of a
     * suggestion.
     */
    socket.on("agent-available", async (info) => {
      const u = socket.data.user;
      if (!u || u.role !== "employee") return;
      if (!(await allowReady(socket, u, info))) return;
      registry.setState(u.id, AGENT_STATE.READY, {
        extension: info && info.extension,
        campaignId: info && info.campaignId,
        reason: "agent-available",
      });
    });

    /** Agent stepped away (break / stop dialer / campaign switch). */
    socket.on("agent-break", (info) => {
      const u = socket.data.user;
      if (!u || u.role !== "employee") return;
      registry.setState(u.id, AGENT_STATE.PAUSE, {
        reason: (info && info.reason) || "break",
      });
    });

    /** Explicit state control for clients that want the full vocabulary. */
    socket.on("agent-state", async (payload) => {
      const u = socket.data.user;
      if (!u || u.role !== "employee") return;
      const next = payload && String(payload.state || "").toUpperCase();
      if (!next || !AGENT_STATE[next]) return;
      // Same gate as agent-available: this is the other way into READY.
      if (next === AGENT_STATE.READY && !(await allowReady(socket, u, payload))) return;
      registry.setState(u.id, next, {
        extension: payload.extension,
        campaignId: payload.campaignId,
        reason: payload.reason || "client",
      });
    });

    socket.on("disconnect", () => {
      const u = socket.data.user;
      if (!u || u.role !== "employee") return;
      const stillConnected = [...io.sockets.sockets.values()].some(
        (s) => s.id !== socket.id && s.data.user && s.data.user.id === u.id,
      );
      if (!stillConnected) registry.disconnect(u.id);
    });
  });

  server.listen(port, () => {
    console.log(
      `> Call Center Platform ready on https://localhost:${port}  ` +
        `(${dev ? "development" : "production"})`,
    );
  });

  // ---- Asterisk ARI: manual, inbound and predictive call control ----
  const ari = startAri({
    ariUrl: process.env.ARI_URL || "http://127.0.0.1:8088",
    ariUser: process.env.ARI_USER || "admin",
    ariPass: process.env.ARI_PASS || "adminsecret",
    ariApp: process.env.ARI_APP || "callapp",
    browserEndpoint: process.env.BROWSER_ENDPOINT || "6001",
    outboundPrefix: process.env.OUTBOUND_PREFIX || "",
    callerId: process.env.CALLER_ID || "",
  });

  // ---- Predictive engine: pacing, claiming, dialing, recycling ----
  const engine = startPredictiveEngine({ io, registry, ari });

  ari.setHandlers({
    onRinging: engine.onRinging,
    onAnswered: engine.onAnswered,
    onBridged: engine.onBridged,
    onEnded: engine.onEnded,
    // Inbound calls go to a genuinely READY agent before falling back to
    // "any registered endpoint".
    pickInboundAgent: () => {
      const ready = registry.readyFor(null);
      return ready.length > 0 ? ready[0].extension : null;
    },
  });

  // Expose both so Next.js API routes (same process) can read live state and
  // kick the dialer — see src/lib/realtime.ts.
  globalThis.__ccEngine = engine;
  globalThis.__ccRegistry = registry;

  const shutdown = () => {
    try {
      engine.stop();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  
});

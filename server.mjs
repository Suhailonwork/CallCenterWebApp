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

const here = dirname(fileURLToPath(import.meta.url));

// Load .env so JWT_SECRET is available for socket authentication.
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
    /* ignore - rely on the real environment */
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
  const server = createServer({ key: readFileSync(process.env.TLS_KEY), cert: readFileSync(process.env.TLS_CERT) }, (req, res) => handle(req, res));
  const io = new SocketServer(server, { path: "/socket.io" });

  // Expose io so Next.js API routes can broadcast (see src/lib/realtime.ts).
  globalThis.__ccio = io;

  // Live agent presence: employee user id -> { id, name, state }.
  const agents = new Map();
  const snapshot = () => [...agents.values()];

  io.on("connection", async (socket) => {
    const user = await userFromCookie(socket.handshake.headers.cookie);
    socket.data.user = user;

    if (user && user.role === "employee") {
      agents.set(user.id, { id: user.id, name: user.name, state: "online" });
      io.emit("agents-updated", snapshot());
    }
    socket.emit("agents-updated", snapshot());

    // Dialer reports the agent's current call state.
    socket.on("set-state", (state) => {
      const u = socket.data.user;
      if (u && u.role === "employee" && agents.has(u.id)) {
        agents.get(u.id).state = String(state || "online");
        io.emit("agents-updated", snapshot());
      }
    });

    socket.on("disconnect", () => {
      const u = socket.data.user;
      if (!u || u.role !== "employee") return;
      const stillConnected = [...io.sockets.sockets.values()].some(
        (s) => s.id !== socket.id && s.data.user && s.data.user.id === u.id,
      );
      if (!stillConnected) {
        agents.delete(u.id);
        io.emit("agents-updated", snapshot());
      }
    });
  });

  server.listen(port, () => {
    console.log(
      `> Call Center Platform ready on http://localhost:${port}  ` +
        `(${dev ? "development" : "production"})`,
    );
  });

  // ✅ Connect to Asterisk ARI for ringback control
  startAri({
    ariUrl: process.env.ARI_URL || "http://127.0.0.1:8088",
    ariUser: process.env.ARI_USER || "admin",
    ariPass: process.env.ARI_PASS || "adminsecret",
    ariApp: process.env.ARI_APP || "callapp",
    trunkEndpoint: process.env.TRUNK_ENDPOINT || "dinstar",
    browserEndpoint: process.env.BROWSER_ENDPOINT || "6001",
    outboundPrefix: process.env.OUTBOUND_PREFIX || "",
    callerId: process.env.CALLER_ID || "",
  });
});

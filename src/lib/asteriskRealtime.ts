/**
 * asteriskRealtime.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Writes PJSIP config rows into Asterisk's realtime tables
 * (ps_endpoints, ps_auths, ps_aors, ps_endpoint_id_ips).
 *
 * Asterisk reads these tables live — no pjsip.conf edits and no
 * "pjsip reload" is needed after calling these helpers.
 *
 * Prerequisites — run once on your Asterisk MySQL DB:
 *   mysql -u root -p callcenter < db/asterisk-realtime-tables.sql
 *
 * Then configure Asterisk as described in ASTERISK_REALTIME_SETUP.md.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { pool } from "./db";

/** Pool ya transaction-connection — dono .execute() rakhte hain.
 *  Isse caller transaction ke andar provision kar sakta hai. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlExecutor = { execute: (sql: string, values?: any[]) => Promise<any> };

/** Stable, auto-generated Asterisk endpoint name for a gateway.
 *  Gateway DB id=1 → "gw1", id=12 → "gw12". Never changes, never typed by hand. */
export function gwEndpoint(gatewayId: number): string {
  return `gw${gatewayId}`;
}

/** Ask Asterisk (via ARI) to reload PJSIP and qualify a gateway immediately,
 *  so a newly added/edited gateway reflects online/offline status right away
 *  without anyone running "pjsip qualify" on the CLI. Best-effort: never throws. */
async function reloadAndQualifyGateway(endpoint: string): Promise<void> {
  const ariUrl = process.env.ARI_URL ?? "http://127.0.0.1:8088";
  const ariUser = process.env.ARI_USER ?? "admin";
  const ariPass = process.env.ARI_PASS ?? "adminsecret";
  const auth =
    "Basic " + Buffer.from(`${ariUser}:${ariPass}`).toString("base64");

  // Reload PJSIP so the realtime change is picked up.
  await fetch(`${ariUrl}/ari/asterisk/modules/res_pjsip.so`, {
    method: "PUT",
    headers: { Authorization: auth },
  }).catch(() => {});

  // Give the reload a moment, then send a qualify (SIP OPTIONS ping).
  await new Promise((r) => setTimeout(r, 1500));
  await fetch(
    `${ariUrl}/ari/endpoints/PJSIP/${encodeURIComponent(endpoint)}/qualify`,
    {
      method: "POST",
      headers: { Authorization: auth },
    },
  ).catch(() => {});
}

// ── Employee WebRTC endpoint ─────────────────────────────────────────────────

export async function provisionEmployeeEndpoint(
  extension: string,
  password = "webrtcpass",
  executor: SqlExecutor = pool,
): Promise<void> {
  // ps_endpoints
  await executor.execute(
    `INSERT INTO ps_endpoints
       (id, transport, aors, auth, context,
        disallow, allow, webrtc, dtls_auto_generate_cert,
        direct_media)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       transport=VALUES(transport), aors=VALUES(aors), auth=VALUES(auth),
       context=VALUES(context), disallow=VALUES(disallow), allow=VALUES(allow),
       webrtc=VALUES(webrtc), dtls_auto_generate_cert=VALUES(dtls_auto_generate_cert)`,
    [
      extension, // id
      "transport-wss", // transport
      extension, // aors
      `${extension}-auth`, // auth
      "from-webrtc", // context
      "all", // disallow
      "ulaw,alaw", // allow
      "yes", // webrtc
      "yes", // dtls_auto_generate_cert
      "no", // direct_media (must be no for WebRTC)
    ],
  );

  // ps_auths
  await executor.execute(
    `INSERT INTO ps_auths (id, auth_type, username, password)
     VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE password=VALUES(password)`,
    [`${extension}-auth`, "userpass", extension, password],
  );

  // ps_aors
  await executor.execute(
    `INSERT INTO ps_aors (id, max_contacts, remove_existing)
     VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE max_contacts=VALUES(max_contacts)`,
    [extension, 1, "yes"],
  );
}

export async function deprovisionEmployeeEndpoint(
  extension: string,
): Promise<void> {
  await pool.execute("DELETE FROM ps_endpoints WHERE id = ?", [extension]);
  await pool.execute("DELETE FROM ps_auths     WHERE id = ?", [
    `${extension}-auth`,
  ]);
  await pool.execute("DELETE FROM ps_aors      WHERE id = ?", [extension]);
}

// ── GSM Gateway endpoint ─────────────────────────────────────────────────────

export async function provisionGatewayEndpoint(
  gatewayId: number,
  ip: string,
  port: number,
): Promise<void> {
  const name = gwEndpoint(gatewayId); // always "gw{id}" — no human input
  const contact = `sip:${ip}:${port}`;

  // ps_endpoints
  await pool.execute(
    `INSERT INTO ps_endpoints
       (id, transport, aors, context,
        disallow, allow, direct_media, rtp_symmetric, rewrite_contact)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       transport=VALUES(transport), aors=VALUES(aors), context=VALUES(context),
       disallow=VALUES(disallow), allow=VALUES(allow),
       direct_media=VALUES(direct_media), rtp_symmetric=VALUES(rtp_symmetric),
       rewrite_contact=VALUES(rewrite_contact)`,
    [
      name,
      "transport-udp",
      name,
      "from-dinstar",
      "all",
      "ulaw,alaw",
      "no",
      "yes",
      "yes",
    ],
  );

  // ps_aors
  await pool.execute(
    `INSERT INTO ps_aors (id, contact, qualify_frequency)
     VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE contact=VALUES(contact), qualify_frequency=VALUES(qualify_frequency)`,
    // qualify_frequency=30: this gateway answers SIP OPTIONS, so qualify gives
    // reliable real-time online/offline detection.
    [name, contact, 30],
  );

  // ps_endpoint_id_ips
  await pool.execute(
    `INSERT INTO ps_endpoint_id_ips (id, endpoint, \`match\`)
     VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE endpoint=VALUES(endpoint), \`match\`=VALUES(\`match\`)`,
    [`${name}-identify`, name, ip],
  );

  // Trigger an immediate reload + qualify so the gateway shows its true
  // online/offline status right away (no manual "pjsip qualify" needed).
  try {
    await reloadAndQualifyGateway(name);
  } catch {
    /* non-fatal — qualify will also happen on the next qualify_frequency cycle */
  }
}

export async function deprovisionGatewayEndpoint(
  gatewayId: number,
): Promise<void> {
  const name = gwEndpoint(gatewayId);
  await pool.execute("DELETE FROM ps_endpoints        WHERE id = ?", [name]);
  await pool.execute("DELETE FROM ps_aors             WHERE id = ?", [name]);
  await pool.execute("DELETE FROM ps_endpoint_id_ips  WHERE id = ?", [
    `${name}-identify`,
  ]);

  // Reload PJSIP so the removed endpoint disappears from Asterisk immediately.
  try {
    await reloadAndQualifyGateway(name);
  } catch {
    /* non-fatal */
  }
}
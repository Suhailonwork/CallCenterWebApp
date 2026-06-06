/**
 * generate-pjsip.mjs
 * ─────────────────────────────────────────────────────────────────
 * Reads employees + GSM gateways from MySQL and regenerates the
 * dynamic sections of asterisk_server/pjsip.conf.
 *
 * Usage:
 *   node generate-pjsip.mjs
 *   asterisk -rx "pjsip reload"
 *
 * Set DB credentials via env vars or edit the defaults below.
 * ─────────────────────────────────────────────────────────────────
 */

import mysql from 'mysql2/promise';
import fs    from 'fs/promises';
import path  from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB = {
  host:     process.env.DB_HOST     ?? '127.0.0.1',
  port:     Number(process.env.DB_PORT ?? 3306),
  user:     process.env.DB_USER     ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME     ?? 'callcenter',
};

const CONF_PATH = path.join(__dirname, 'asterisk_server', 'pjsip.conf');
const STATIC_MARKER = '# ── AUTO-GENERATED BELOW – DO NOT EDIT MANUALLY ──';

// ── helpers ─────────────────────────────────────────────────────────

function employeeBlock(ext, password = 'webrtcpass') {
  return `
[${ext}]
type=endpoint
transport=transport-wss
aors=${ext}
auth=${ext}-auth
context=from-webrtc
disallow=all
allow=ulaw,alaw
webrtc=yes
dtls_auto_generate_cert=yes

[${ext}-auth]
type=auth
auth_type=userpass
username=${ext}
password=${password}

[${ext}]
type=aor
max_contacts=1
remove_existing=yes
`.trimStart();
}

function gatewayBlock(name, ip, port = 5060) {
  return `
[${name}]
type=endpoint
transport=transport-udp
context=from-gsm
disallow=all
allow=ulaw,alaw
aors=${name}
direct_media=no
rtp_symmetric=yes
rewrite_contact=yes
from_user=${name}

[${name}]
type=aor
contact=sip:${ip}:${port}
qualify_frequency=30

[${name}]
type=identify
endpoint=${name}
match=${ip}
`.trimStart();
}

// ── main ─────────────────────────────────────────────────────────────

const conn = await mysql.createConnection(DB);

const [employees] = await conn.execute(
  'SELECT e.sip_extension, e.sip_password FROM employees e JOIN users u ON u.id = e.user_id WHERE u.is_active = 1',
);
const [gateways]  = await conn.execute(
  "SELECT name, ip, port FROM gsm_gateways WHERE status = 'active'",
);

await conn.end();

// Read existing static portion of the file (everything before the marker)
let existing = '';
try {
  existing = await fs.readFile(CONF_PATH, 'utf8');
} catch {
  console.warn('pjsip.conf not found – will create it from scratch.');
}

const markerIdx = existing.indexOf(STATIC_MARKER);
const staticPart = markerIdx >= 0 ? existing.slice(0, markerIdx).trimEnd() : existing.trimEnd();

const lines = [
  staticPart,
  '',
  STATIC_MARKER,
  '',
  '; ── Employee WebRTC endpoints ──────────────────────────────────────',
  ...employees.map((e) => employeeBlock(e.sip_extension, e.sip_password ?? 'webrtcpass')),
  '',
  '; ── GSM Gateway endpoints ──────────────────────────────────────────',
  ...gateways.map((g) => gatewayBlock(g.name, g.ip, g.port)),
  '',
].join('\n');

await fs.writeFile(CONF_PATH, lines, 'utf8');

console.log(`✅  pjsip.conf updated`);
console.log(`   Employees : ${employees.length}`);
console.log(`   Gateways  : ${gateways.length}`);
console.log('');
console.log('Run:  asterisk -rx "pjsip reload"');

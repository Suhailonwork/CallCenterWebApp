// =====================================================================
//  db/seed.mjs - inserts demo data for all four roles.
//  Run with:  npm run db:seed   (run db:migrate first)
//
//  Every demo account uses the password:  Password123!
// =====================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const here = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const txt = readFileSync(join(here, '..', '.env'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* ignore */
  }
}
loadEnv();

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'callcenter',
} = process.env;

const db = await mysql.createConnection({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
});

const PASSWORD = 'Password123!';
const hash = await bcrypt.hash(PASSWORD, 10);

// Clear existing rows (children first).
for (const t of [
  'agent_sessions', 'campaign_assignments', 'settings', 'audit_logs',
  'performance', 'breaks', 'scheduled_calls', 'call_notes', 'calls',
  'csv_data', 'lists', 'campaigns', 'employees', 'teams',
]) {
  await db.execute(`DELETE FROM ${t}`);
}
await db.execute('UPDATE users SET team_id = NULL, reports_to = NULL');
await db.execute('DELETE FROM users');

async function addUser(name, email, role) {
  const [r] = await db.execute(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)',
    [name, email, hash, role],
  );
  return r.insertId;
}

// ---- users ----
const admin = await addUser('Aarav Admin', 'admin@cc.test', 'admin');
const mgr1 = await addUser('Marcus Manager', 'manager1@cc.test', 'manager');
const mgr2 = await addUser('Maria Manager', 'manager2@cc.test', 'manager');
const tl1 = await addUser('Tara Lead', 'tl1@cc.test', 'tl');
const tl2 = await addUser('Tom Lead', 'tl2@cc.test', 'tl');
const tl3 = await addUser('Tina Lead', 'tl3@cc.test', 'tl');

const empDefs = [
  ['Eva Employee', 'emp1@cc.test'],
  ['Ethan Employee', 'emp2@cc.test'],
  ['Olivia Employee', 'emp3@cc.test'],
  ['Liam Employee', 'emp4@cc.test'],
  ['Sophia Employee', 'emp5@cc.test'],
  ['Noah Employee', 'emp6@cc.test'],
];
const emp = [];
for (const [name, email] of empDefs) emp.push(await addUser(name, email, 'employee'));

// ---- teams ----
async function addTeam(name, managerId, tlId) {
  const [r] = await db.execute(
    'INSERT INTO teams (name, manager_id, tl_id) VALUES (?,?,?)',
    [name, managerId, tlId],
  );
  return r.insertId;
}
const teamAlpha = await addTeam('Team Alpha', mgr1, tl1);
const teamBeta = await addTeam('Team Beta', mgr1, tl2);
const teamGamma = await addTeam('Team Gamma', mgr2, tl3);

// ---- hierarchy wiring ----
async function wire(userId, teamId, reportsTo) {
  await db.execute('UPDATE users SET team_id = ?, reports_to = ? WHERE id = ?', [
    teamId, reportsTo, userId,
  ]);
}
await wire(mgr1, null, admin);
await wire(mgr2, null, admin);
await wire(tl1, teamAlpha, mgr1);
await wire(tl2, teamBeta, mgr1);
await wire(tl3, teamGamma, mgr2);

const teamOf = [teamAlpha, teamAlpha, teamBeta, teamBeta, teamGamma, teamGamma];
const tlOf = [tl1, tl1, tl2, tl2, tl3, tl3];
for (let i = 0; i < emp.length; i++) await wire(emp[i], teamOf[i], tlOf[i]);

// ---- employees profile rows (SIP extensions 6001..6006) ----
for (let i = 0; i < emp.length; i++) {
  await db.execute(
    'INSERT INTO employees (user_id, sip_extension, sip_password, status) VALUES (?,?,?,?)',
    [emp[i], String(6001 + i), 'webrtcpass', 'offline'],
  );
}

// ---- campaign + contacts ----
const [camp] = await db.execute(
  `INSERT INTO campaigns (name, description, script, created_by, status, calling_start, calling_end)
   VALUES (?,?,?,?,?,?,?)`,
  [
    'Spring Outreach 2026',
    'Outbound outreach to warm leads from the spring marketing list.',
    'Hi {name}, this is {agent} calling from our team. Do you have a quick minute to talk about how we can help {company}?',
    admin,
    'active',
    '09:00:00',
    '18:00:00',
  ],
);
const campaignId = camp.insertId;

// Every lead belongs to a list; the demo campaign gets one active Default List.
const [seedList] = await db.execute(
  `INSERT INTO lists (name, description, campaign_id, active) VALUES (?,?,?,'Y')`,
  ['Default List', 'Demo leads for Spring Outreach 2026', campaignId],
);
const listId = seedList.insertId;

const contacts = [
  ['9818435920', 'Rohan Sharma', 'rohan@acme.example', 'Acme Corp'],
  ['9810012345', 'Priya Verma', 'priya@globex.example', 'Globex'],
  ['9820011223', 'Ankit Gupta', 'ankit@initech.example', 'Initech'],
  ['9830044556', 'Sneha Iyer', 'sneha@umbrella.example', 'Umbrella Ltd'],
  ['9840077889', 'Vikram Singh', 'vikram@hooli.example', 'Hooli'],
  ['9850099001', 'Neha Kapoor', 'neha@stark.example', 'Stark Industries'],
  ['9860022334', 'Arjun Mehta', 'arjun@wayne.example', 'Wayne Enterprises'],
  ['9870055667', 'Divya Nair', 'divya@wonka.example', 'Wonka Inc'],
  ['9880088990', 'Karan Joshi', 'karan@soylent.example', 'Soylent Co'],
  ['9890011224', 'Pooja Reddy', 'pooja@cyberdyne.example', 'Cyberdyne'],
];
for (const [phone, name, email, company] of contacts) {
  await db.execute(
    'INSERT INTO csv_data (campaign_id, list_id, phone_number, name, email, company) VALUES (?,?,?,?,?,?)',
    [campaignId, listId, phone, name, email, company],
  );
}

// ---- assign the campaign to the first two employees ----
for (const empId of [emp[0], emp[1]]) {
  await db.execute(
    'INSERT INTO campaign_assignments (campaign_id, employee_id, assigned_by) VALUES (?,?,?)',
    [campaignId, empId, admin],
  );
}

// ---- demo calls + notes for the first employee (so the dashboard has data) ----
const statuses = ['connected', 'no_answer', 'busy', 'connected', 'voicemail', 'connected'];
let callsMade = 0;
for (let day = 6; day >= 0; day--) {
  const n = 2 + (day % 3); // 2-4 calls per day
  for (let k = 0; k < n; k++) {
    const status = statuses[(day + k) % statuses.length];
    const duration = status === 'connected' ? 90 + ((day + k) * 37) % 400 : 0;
    const [c] = await db.execute(
      `INSERT INTO calls
         (employee_id, campaign_id, phone_number, contact_name, direction, status,
          duration_seconds, started_at, ended_at, created_at)
       VALUES (?,?,?,?, 'outbound', ?, ?,
          DATE_SUB(NOW(), INTERVAL ${day} DAY),
          DATE_SUB(NOW(), INTERVAL ${day} DAY),
          DATE_SUB(NOW(), INTERVAL ${day} DAY))`,
      [
        emp[0], campaignId,
        contacts[(day + k) % contacts.length][0],
        contacts[(day + k) % contacts.length][1],
        status, duration,
      ],
    );
    callsMade++;
    if (status === 'connected') {
      await db.execute(
        'INSERT INTO call_notes (call_id, employee_id, note, tags) VALUES (?,?,?,?)',
        [c.insertId, emp[0], 'Spoke with the contact, interested - follow up later.', 'interested'],
      );
    }
  }
}

// ---- a couple of scheduled follow-ups for the first employee ----
await db.execute(
  `INSERT INTO scheduled_calls (phone_number, contact_name, scheduled_at, assigned_to, status)
   VALUES (?,?, DATE_ADD(NOW(), INTERVAL 2 HOUR), ?, 'pending')`,
  ['9810012345', 'Priya Verma', emp[0]],
);
await db.execute(
  `INSERT INTO scheduled_calls (phone_number, contact_name, scheduled_at, assigned_to, status)
   VALUES (?,?, DATE_ADD(NOW(), INTERVAL 1 DAY), ?, 'pending')`,
  ['9820011223', 'Ankit Gupta', emp[0]],
);

// ---- a couple of past login sessions for the first employee ----
await db.execute(
  `INSERT INTO agent_sessions (employee_id, login_at, logout_at)
   VALUES (?, DATE_SUB(NOW(), INTERVAL 7 HOUR), DATE_SUB(NOW(), INTERVAL 4 HOUR))`,
  [emp[0]],
);
await db.execute(
  `INSERT INTO agent_sessions (employee_id, login_at)
   VALUES (?, DATE_SUB(NOW(), INTERVAL 2 HOUR))`,
  [emp[0]],
);

// ---- default system settings ----
const defaultSettings = [
  ['break_minutes_per_day', '60'],
  ['max_breaks_per_day', '4'],
  ['call_limit_per_day', '120'],
  ['work_start', '09:00'],
  ['work_end', '18:00'],
  ['min_password_length', '8'],
  ['recording_retention_days', '90'],
];
for (const [k, v] of defaultSettings) {
  await db.execute(
    'INSERT INTO settings (setting_key, setting_value) VALUES (?,?)',
    [k, v],
  );
}

console.log('OK  seed complete');
console.log('--------------------------------------------------');
console.log('  Login with any of these (password: ' + PASSWORD + ')');
console.log('  Admin    : admin@cc.test');
console.log('  Manager  : manager1@cc.test / manager2@cc.test');
console.log('  Team Lead: tl1@cc.test / tl2@cc.test / tl3@cc.test');
console.log('  Employee : emp1@cc.test ... emp6@cc.test');
console.log('--------------------------------------------------');
console.log('  ' + callsMade + ' demo calls created for emp1@cc.test');

await db.end();

// =====================================================================
//  db/migrate-lists.mjs — ADDITIVE migration for the VICIdial-style Lists
//  layer. Run with:  npm run db:migrate:lists
//
//  Safe on a live database and idempotent (re-running is a no-op):
//   1. Creates the `lists` table (004-lists.sql).
//   2. Adds csv_data columns: list_id (FK), call_count, last_call_at,
//      recycle_attempts — and promotes call_status to NOT NULL DEFAULT 'NEW'
//      ('NEW' = never dialed; existing NULLs are backfilled to 'NEW').
//   3. Adds campaigns columns: dial_statuses JSON, recycle_rules JSON, and
//      backfills the defaults ("NEW"/"no_answer"/"busy" — this app's
//      vocabulary for VICIdial's NEW/NA/B).
//   4. For every campaign that has no list yet: creates a list named
//      "Default List" (active='Y', template_id = the campaign's own
//      data_table_id so upload behavior is unchanged) and re-homes all of
//      that campaign's leads into it (csv_data.list_id backfill).
//
//  After this migration the app behaves identically: every lead sits in an
//  active list, every status stays claimable by default, nothing is lost.
//
//  Reverse with:  npm run db:rollback:lists   (db/rollback-lists.mjs)
// =====================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import mysql from 'mysql2/promise';

const here = dirname(fileURLToPath(import.meta.url));

// Minimal .env loader (these scripts run outside Next.js).
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
    /* no .env file - rely on real environment */
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

// Kept in sync with src/lib/dialEligibility.js (DEFAULT_DIAL_STATUSES / DEFAULT_RECYCLE_RULES).
const DEFAULT_DIAL_STATUSES = ['NEW', 'no_answer', 'busy'];
const DEFAULT_RECYCLE_RULES = [
  { status: 'no_answer', delay_min: 60, max_attempts: 3 },
  { status: 'busy', delay_min: 30, max_attempts: 3 },
];

const sql = readFileSync(join(here, 'migrations', '004-lists.sql'), 'utf8');

const conn = await mysql.createConnection({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  multipleStatements: true,
});

async function columnExists(table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [DB_NAME, table, column],
  );
  return Number(rows[0].c) > 0;
}

async function indexExists(table, index) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [DB_NAME, table, index],
  );
  return Number(rows[0].c) > 0;
}

async function fkExists(table, fk) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    [DB_NAME, table, fk],
  );
  return Number(rows[0].c) > 0;
}

// ---- 1. lists table ----
await conn.query(sql);
console.log('OK  lists table ready');

// ---- 2. csv_data columns ----
if (!(await columnExists('csv_data', 'list_id'))) {
  await conn.query(`ALTER TABLE csv_data ADD COLUMN list_id INT NULL AFTER campaign_id`);
  console.log('OK  csv_data.list_id column added');
} else {
  console.log('OK  csv_data.list_id already exists');
}
if (!(await fkExists('csv_data', 'fk_csv_list'))) {
  // ON DELETE CASCADE: deleting a list deletes its leads (the API only allows
  // deleting EMPTY lists, so this is a backstop for manual SQL, and it lets a
  // campaign delete cascade cleanly through both csv_data FKs).
  await conn.query(
    `ALTER TABLE csv_data ADD CONSTRAINT fk_csv_list
       FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE`,
  );
  console.log('OK  csv_data.fk_csv_list foreign key added');
}
if (!(await indexExists('csv_data', 'idx_csv_list_called'))) {
  await conn.query(`ALTER TABLE csv_data ADD INDEX idx_csv_list_called (list_id, called)`);
  console.log('OK  csv_data idx_csv_list_called index added');
}
if (!(await columnExists('csv_data', 'call_count'))) {
  await conn.query(`ALTER TABLE csv_data ADD COLUMN call_count INT NOT NULL DEFAULT 0 AFTER call_status`);
  console.log('OK  csv_data.call_count column added');
}
if (!(await columnExists('csv_data', 'last_call_at'))) {
  await conn.query(`ALTER TABLE csv_data ADD COLUMN last_call_at DATETIME NULL AFTER call_count`);
  console.log('OK  csv_data.last_call_at column added');
}
if (!(await columnExists('csv_data', 'recycle_attempts'))) {
  await conn.query(`ALTER TABLE csv_data ADD COLUMN recycle_attempts INT NOT NULL DEFAULT 0 AFTER last_call_at`);
  console.log('OK  csv_data.recycle_attempts column added');
}

// call_status becomes the lead STATUS: 'NEW' = never dialed. Backfill first so
// the MODIFY (NOT NULL) cannot fail on existing NULL rows.
const [statusMeta] = await conn.query(
  `SELECT IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'csv_data' AND COLUMN_NAME = 'call_status'`,
  [DB_NAME],
);
const [nullBackfill] = await conn.query(
  `UPDATE csv_data SET call_status = 'NEW' WHERE call_status IS NULL`,
);
if (nullBackfill.affectedRows > 0) {
  console.log(`OK  csv_data.call_status: ${nullBackfill.affectedRows} NULL rows backfilled to 'NEW'`);
}
if (statusMeta[0].IS_NULLABLE === 'YES' || statusMeta[0].COLUMN_DEFAULT !== 'NEW') {
  await conn.query(
    `ALTER TABLE csv_data MODIFY call_status VARCHAR(32) NOT NULL DEFAULT 'NEW'
       COMMENT 'Lead status: NEW = never dialed, else last disposition'`,
  );
  console.log("OK  csv_data.call_status is now NOT NULL DEFAULT 'NEW'");
} else {
  console.log('OK  csv_data.call_status already NOT NULL DEFAULT NEW');
}

// ---- 3. campaigns columns ----
if (!(await columnExists('campaigns', 'dial_statuses'))) {
  await conn.query(
    `ALTER TABLE campaigns ADD COLUMN dial_statuses JSON NULL
       COMMENT 'Lead statuses the dialer may claim (JSON array); NULL = default NEW/no_answer/busy'`,
  );
  console.log('OK  campaigns.dial_statuses column added');
}
if (!(await columnExists('campaigns', 'recycle_rules'))) {
  await conn.query(
    `ALTER TABLE campaigns ADD COLUMN recycle_rules JSON NULL
       COMMENT 'Auto-retry rules: [{status, delay_min, max_attempts}]; NULL/[] = no recycling'`,
  );
  console.log('OK  campaigns.recycle_rules column added');
}
const [ds] = await conn.query(
  `UPDATE campaigns SET dial_statuses = ? WHERE dial_statuses IS NULL`,
  [JSON.stringify(DEFAULT_DIAL_STATUSES)],
);
if (ds.affectedRows > 0) console.log(`OK  dial_statuses default set on ${ds.affectedRows} campaigns`);
const [rr] = await conn.query(
  `UPDATE campaigns SET recycle_rules = ? WHERE recycle_rules IS NULL`,
  [JSON.stringify(DEFAULT_RECYCLE_RULES)],
);
if (rr.affectedRows > 0) console.log(`OK  recycle_rules default set on ${rr.affectedRows} campaigns`);

// ---- 4. Backfill: one "Default List" per campaign, re-home its leads ----
// Only campaigns with NO list yet get one, so re-running never duplicates.
const [made] = await conn.query(
  `INSERT INTO lists (name, description, campaign_id, active, template_id)
   SELECT 'Default List', 'Auto-created by the lists migration (pre-lists leads)',
          c.id, 'Y', c.data_table_id
     FROM campaigns c
    WHERE NOT EXISTS (SELECT 1 FROM lists l WHERE l.campaign_id = c.id)`,
);
if (made.affectedRows > 0) console.log(`OK  Default List created for ${made.affectedRows} campaigns`);

const [homed] = await conn.query(
  `UPDATE csv_data d
     JOIN lists l ON l.campaign_id = d.campaign_id
      AND l.id = (SELECT MIN(l2.id) FROM lists l2 WHERE l2.campaign_id = d.campaign_id)
     SET d.list_id = l.id
   WHERE d.list_id IS NULL`,
);
if (homed.affectedRows > 0) console.log(`OK  ${homed.affectedRows} existing leads re-homed into their campaign's Default List`);

// ---- summary ----
const [[{ orphans }]] = await conn.query(
  `SELECT COUNT(*) AS orphans FROM csv_data WHERE list_id IS NULL`,
);
const [[{ nLists }]] = await conn.query(`SELECT COUNT(*) AS nLists FROM lists`);
console.log(`DONE  lists=${nLists}, leads without a list=${orphans} (must be 0)`);
if (Number(orphans) > 0) {
  console.warn('WARN  some leads have no list — re-run this migration or inspect csv_data.list_id');
  process.exitCode = 1;
}

await conn.end();

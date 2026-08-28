// =====================================================================
//  db/migrate-dispositions.mjs — ADDITIVE migration for disposition-driven
//  dialing rules.
//
//  Run with:  npm run db:migrate:dispositions
//
//  Safe on a live database and fully idempotent (re-running is a no-op).
//  Nothing is dropped and no existing column changes meaning:
//
//   1. campaigns.disposition_rules — per-campaign overrides of the dialing
//      rule each disposition produces. NULL (the default) means the catalogue
//      in src/lib/dispositionRules.js decides, so every campaign behaves
//      correctly the moment this runs, with nothing to configure.
//
//   2. calls.disposition_reason — the reason the agent picked under the
//      disposition code. The code alone is too coarse to explain a decision:
//      "Number busy" and "Switch off" are both TNC but retry on different
//      timers, and this is the column that says which rule ran.
//
//   3. An index on csv_data.last_disposition, because the claim query now
//      filters on it on every dialer tick.
// =====================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import mysql from 'mysql2/promise';

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
    /* no .env file — rely on the real environment */
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

/** ADD COLUMN when it is missing. `spec` is everything after the column name. */
async function addColumn(table, column, spec) {
  if (await columnExists(table, column)) {
    console.log(`--  ${table}.${column} already present`);
    return false;
  }
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${spec}`);
  console.log(`OK  ${table}.${column} added`);
  return true;
}

async function addIndex(table, index, cols) {
  if (await indexExists(table, index)) {
    console.log(`--  ${table}.${index} already present`);
    return false;
  }
  await conn.query(`ALTER TABLE \`${table}\` ADD INDEX \`${index}\` (${cols})`);
  console.log(`OK  ${table}.${index} index added`);
  return true;
}

console.log(`\nDisposition rules migration on ${DB_NAME}@${DB_HOST}:${DB_PORT}\n`);

// ---- 1. campaigns: per-campaign rule overrides ----------------------------
await addColumn(
  'campaigns',
  'disposition_rules',
  `JSON NULL
     COMMENT 'Overrides for the disposition dialing rules keyed by code: {"PTP":{action,delay_min,max_attempts,...}}; NULL = the defaults in src/lib/dispositionRules.js'
     AFTER recycle_rules`,
);

// ---- 2. calls: which reason produced the outcome --------------------------
await addColumn(
  'calls',
  'disposition_reason',
  `VARCHAR(120) NULL
     COMMENT 'Reason picked under the disposition code — what the dialing rule keyed on'
     AFTER disposition`,
);

// ---- 3. the claim query now filters on last_disposition -------------------
await addIndex('csv_data', 'idx_csv_last_disposition', 'last_disposition');

console.log('\nDone. Disposition rules are live — the catalogue defaults apply');
console.log('to every campaign until one overrides them.\n');

await conn.end();

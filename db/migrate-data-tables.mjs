// =====================================================================
//  db/migrate-data-tables.mjs — ADDITIVE migration for the Data Tables module.
//  Run with:  npm run db:migrate:data-tables
//
//  Unlike db/migrate.mjs (which DROPS every table), this script is safe
//  on a live database: it only creates the new data_tables table and adds
//  the nullable campaigns.data_table_id column if it does not exist yet.
//  Existing campaigns keep data_table_id = NULL (= store all extra columns).
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
  DB_NAME = 'dialer',
} = process.env;

const sql = readFileSync(join(here, 'migrations', '002-data-tables.sql'), 'utf8');

const conn = await mysql.createConnection({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  multipleStatements: true,
});

await conn.query(sql);
console.log('OK  data_tables table ready');

// campaigns.data_table_id — add only if missing (idempotent).
const [cols] = await conn.query(
  `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'data_table_id'`,
  [DB_NAME],
);
if (Number(cols[0].c) === 0) {
  await conn.query(
    `ALTER TABLE campaigns ADD COLUMN data_table_id INT NULL AFTER group_id`,
  );
  console.log('OK  campaigns.data_table_id column added (NULL for all existing campaigns)');
} else {
  console.log('OK  campaigns.data_table_id already exists — nothing to do');
}

await conn.end();

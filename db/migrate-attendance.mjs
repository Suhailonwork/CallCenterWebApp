// =====================================================================
//  db/migrate-attendance.mjs — ADDITIVE migration for Attendance & Login
//  Tracking.  Run with:  npm run db:migrate:attendance
//
//  Unlike db/migrate.mjs (which DROPS every table), this script is safe on a
//  live database: it only creates the new shifts / attendance_sessions tables
//  and adds the nullable users.shift_id column if it does not exist yet.
//  Existing users keep shift_id = NULL (= no shift assigned).
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

const sql = readFileSync(join(here, 'migrations', '003-attendance.sql'), 'utf8');

const conn = await mysql.createConnection({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  multipleStatements: true,
});

await conn.query(sql);
console.log('OK  shifts / attendance_sessions tables ready');

// users.shift_id — add only if missing (idempotent).
const [cols] = await conn.query(
  `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'shift_id'`,
  [DB_NAME],
);
if (Number(cols[0].c) === 0) {
  await conn.query(
    `ALTER TABLE users
       ADD COLUMN shift_id INT NULL AFTER team_id,
       ADD CONSTRAINT fk_users_shift FOREIGN KEY (shift_id)
           REFERENCES shifts(id) ON DELETE SET NULL,
       ADD INDEX idx_users_shift (shift_id)`,
  );
  console.log('OK  users.shift_id column added (NULL for all existing users)');
} else {
  console.log('OK  users.shift_id already exists — nothing to do');
}

await conn.end();

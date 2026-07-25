// =====================================================================
//  db/migrate-list-fields.mjs — per-list custom fields (ADDITIVE migration).
//  Run with:  npm run db:migrate:list-fields
//
//  Moves the "which CSV columns to store" decision off the shared
//  data_tables template and onto the list itself: adds lists.fields (an
//  ordered JSON array of custom field names). A list with fields = NULL /
//  [] stores every CSV column (legacy behavior); otherwise only those
//  fields, in that order.
//
//  Idempotent. Backfills lists.fields from each list's old template
//  (lists.template_id -> data_tables.columns) so existing lists keep the
//  exact columns they had before. The template_id column is left in place
//  (harmless) but the app no longer uses it.
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
    /* rely on real environment */
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
});

async function columnExists(table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [DB_NAME, table, column],
  );
  return Number(rows[0].c) > 0;
}

if (!(await columnExists('lists', 'fields'))) {
  await conn.query(
    `ALTER TABLE lists ADD COLUMN fields JSON NULL
       COMMENT 'Ordered custom field names stored from CSV uploads; NULL/[] = store all columns'
       AFTER template_id`,
  );
  console.log('OK  lists.fields column added');
} else {
  console.log('OK  lists.fields already exists');
}

// Backfill from the old template so existing lists keep their columns.
if (await columnExists('lists', 'template_id')) {
  const [r] = await conn.query(
    `UPDATE lists l
       JOIN data_tables dt ON dt.id = l.template_id
        SET l.fields = dt.columns
      WHERE l.fields IS NULL AND l.template_id IS NOT NULL`,
  );
  if (r.affectedRows > 0) {
    console.log(`OK  ${r.affectedRows} lists backfilled fields from their template`);
  }
}

const [[{ n }]] = await conn.query(
  `SELECT COUNT(*) AS n FROM lists WHERE fields IS NOT NULL`,
);
console.log(`DONE  ${n} lists now carry their own custom fields`);

await conn.end();

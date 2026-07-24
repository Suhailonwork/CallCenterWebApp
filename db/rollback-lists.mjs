// =====================================================================
//  db/rollback-lists.mjs — reverses db/migrate-lists.mjs.
//  Run with:  npm run db:rollback:lists
//
//  Zero data loss for pre-migration data: leads keep campaign_id, so
//  dropping list_id returns csv_data to exactly its pre-lists shape.
//  call_status is made nullable again and 'NEW' rows revert to NULL
//  (the pre-migration representation of "never called").
//
//  NOTE: only roll back the DB together with checking out pre-lists code —
//  the lists-aware claim query / upload flow require these columns.
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

async function fkExists(table, fk) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    [DB_NAME, table, fk],
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

// csv_data: drop the lists-era columns (FK and index first — dropping the
// column alone would leave idx_csv_list_called behind as an index on
// (called) only, and a later re-migration would then skip recreating it).
if (await fkExists('csv_data', 'fk_csv_list')) {
  await conn.query(`ALTER TABLE csv_data DROP FOREIGN KEY fk_csv_list`);
  console.log('OK  csv_data.fk_csv_list dropped');
}
if (await indexExists('csv_data', 'idx_csv_list_called')) {
  await conn.query(`ALTER TABLE csv_data DROP INDEX idx_csv_list_called`);
  console.log('OK  csv_data idx_csv_list_called index dropped');
}
for (const col of ['list_id', 'call_count', 'last_call_at', 'recycle_attempts']) {
  if (await columnExists('csv_data', col)) {
    await conn.query(`ALTER TABLE csv_data DROP COLUMN ${col}`);
    console.log(`OK  csv_data.${col} dropped`);
  }
}

// call_status back to its pre-migration shape (nullable, NULL = never called).
if (await columnExists('csv_data', 'call_status')) {
  await conn.query(`ALTER TABLE csv_data MODIFY call_status VARCHAR(32) NULL DEFAULT NULL`);
  const [rev] = await conn.query(`UPDATE csv_data SET call_status = NULL WHERE call_status = 'NEW'`);
  console.log(`OK  csv_data.call_status nullable again (${rev.affectedRows} 'NEW' rows reverted to NULL)`);
}

// campaigns: drop the rules columns.
for (const col of ['dial_statuses', 'recycle_rules']) {
  if (await columnExists('campaigns', col)) {
    await conn.query(`ALTER TABLE campaigns DROP COLUMN ${col}`);
    console.log(`OK  campaigns.${col} dropped`);
  }
}

// Finally the lists table itself.
await conn.query(`DROP TABLE IF EXISTS lists`);
console.log('OK  lists table dropped');
console.log('DONE  lists layer rolled back — csv_data/campaigns are back to their pre-lists shape');

await conn.end();

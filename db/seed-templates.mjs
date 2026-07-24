// =====================================================================
//  db/seed-templates.mjs — seeds the three standard Data Templates
//  (data_tables rows) used for list CSV uploads.
//  Run with:  npm run db:seed:templates
//
//  Idempotent: a template is skipped if a data_table with the same name
//  already exists (existing rows are never modified, so admin edits to
//  a template survive re-runs).
//
//  Field names and their ORDER come verbatim from Updated.xlsx — the
//  spellings ("Tital ( peority Data )", "Delear Name", "Curent BKT",
//  "M_ Data", "Ref -1 Name", ...) are intentional and must match the
//  customers' CSV headers. Header matching at upload time is forgiving:
//  trimmed, internal whitespace collapsed, case-insensitive
//  (see normalizeHeader in src/lib/csv.ts).
//
//  The dialed phone number comes from the "Mobile NO" column in all
//  three templates (mapColumns in src/lib/csv.ts recognizes it).
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

// ---- The three standard templates (exact names + column order) ----

const DEFAULT_LIST = [
  'Tital ( peority Data )',
  'Customer Name',
  'Address',
  'POST CODE',
  'Mobile NO',
  'LOAN NO',
  'Process Name',
  'City',
  'State',
  'CBC',
  'LPC',
  'Other',
  'Toss',
  'Product',
  'Product Dis',
  'REG NO',
  'Delear Name',
  'Tenure',
  'M_ Data',
  'LMPD',
  'DPD',
  'Ref -1 Name',
  'Ref - No',
  'Ref_2 Name',
  'Ref_2 No',
];

// Default List + EMI, EMI OS (after State), Curent BKT (after LMPD),
// Bounce Reason (after DPD).
const BX_PROCESS = [
  'Tital ( peority Data )',
  'Customer Name',
  'Address',
  'POST CODE',
  'Mobile NO',
  'LOAN NO',
  'Process Name',
  'City',
  'State',
  'EMI',
  'EMI OS',
  'CBC',
  'LPC',
  'Other',
  'Toss',
  'Product',
  'Product Dis',
  'REG NO',
  'Delear Name',
  'Tenure',
  'M_ Data',
  'LMPD',
  'Curent BKT',
  'DPD',
  'Bounce Reason',
  'Ref -1 Name',
  'Ref - No',
  'Ref_2 Name',
  'Ref_2 No',
];

const PI_PROCESS = [
  'Tital ( peority Data )',
  'Customer Name',
  'Address',
  'POST CODE',
  'Mobile NO',
  'Loan NO',
  'Process Name',
  'City',
  'State',
  'CBC',
  'LPC',
  'Other',
  'Toss',
  'Product',
  'Product Dis',
  'REG NO',
  'Delear Name',
  'Tenure',
  'M_ Data',
  'LMPD',
  'DPD',
  'Sett Amount',
  'Ref -1 Name',
  'Ref - No',
  'Ref_2 Name',
  'Ref_2 No',
  'LM PAID Amount',
  'LM PAID Date',
];

const TEMPLATES = [
  { name: 'Default List', columns: DEFAULT_LIST, expect: 25 },
  { name: 'BX Process', columns: BX_PROCESS, expect: 29 },
  { name: 'PI Process', columns: PI_PROCESS, expect: 28 },
];

// Sanity: catch accidental edits to the arrays above before touching the DB.
for (const t of TEMPLATES) {
  if (t.columns.length !== t.expect) {
    console.error(`ABORT  template "${t.name}" has ${t.columns.length} columns, expected ${t.expect}`);
    process.exit(1);
  }
}

const conn = await mysql.createConnection({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
});

for (const t of TEMPLATES) {
  const [existing] = await conn.query(`SELECT id FROM data_tables WHERE name = ? LIMIT 1`, [t.name]);
  if (existing.length > 0) {
    console.log(`SKIP  "${t.name}" already exists (id ${existing[0].id})`);
    continue;
  }
  const [r] = await conn.query(
    `INSERT INTO data_tables (name, columns, created_by) VALUES (?, ?, NULL)`,
    [t.name, JSON.stringify(t.columns)],
  );
  console.log(`OK    "${t.name}" created (id ${r.insertId}, ${t.columns.length} columns)`);
}

console.log('DONE  data templates seeded');
await conn.end();

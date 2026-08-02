// =====================================================================
//  db/migrate-default-fields.mjs — enforce the mandatory default fields on
//  every existing list. Run with:  npm run db:migrate:default-fields
//
//  Idempotent. Rewrites each list's lists.fields to "24 defaults first, then
//  the list's existing custom fields" (deduped case-insensitively). Existing
//  custom fields are preserved after the defaults; existing leads keep
//  working (a lead missing a field just has no value for it).
//
//  The 24 names below MUST match src/lib/listFields.ts DEFAULT_LIST_FIELDS.
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

const DEFAULT_LIST_FIELDS = [
  'Customer Name', 'Mobile No', 'Ref - No', 'Address', 'City', 'State',
  'POST CODE', 'Product', 'Product Dis', 'REG NO', 'DPD', 'LMPD', 'LPC',
  'CBC', 'Tenure', 'Dealer Name', 'Process Name', 'Ref - 1 Name',
  'Ref_2 Name', 'Ref_2 No', 'M_Data', 'Other', 'Toss', 'Title (Priority Data)',
];

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

function compose(existing) {
  const out = [...DEFAULT_LIST_FIELDS];
  const seen = new Set(out.map(norm));
  for (const raw of Array.isArray(existing) ? existing : []) {
    const s = String(raw ?? '').trim();
    if (!s) continue;
    const n = norm(s);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(s);
  }
  return out;
}

const conn = await mysql.createConnection({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
});

const [lists] = await conn.query('SELECT id, fields FROM lists');
let updated = 0;
for (const l of lists) {
  const current = typeof l.fields === 'string' ? safeParse(l.fields) : l.fields;
  const composed = compose(current);
  // Only write when it actually changes, so re-runs are no-ops.
  if (JSON.stringify(current) !== JSON.stringify(composed)) {
    await conn.query('UPDATE lists SET fields = ? WHERE id = ?', [JSON.stringify(composed), l.id]);
    updated++;
  }
}
console.log(`DONE  default fields enforced on ${updated}/${lists.length} lists`);

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

await conn.end();

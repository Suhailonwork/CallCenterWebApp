// =====================================================================
//  db/migrate-vicidial.mjs — ADDITIVE migration that turns the existing
//  schema into a VICIdial-style predictive dialer back end.
//
//  Run with:  npm run db:migrate:vicidial
//
//  Safe on a live database and fully idempotent (re-running is a no-op).
//  Nothing is dropped and no existing column changes meaning:
//
//   1. dialer_log + pending_recordings tables (005-vicidial-dialer.sql).
//   2. csv_data      — lifecycle columns: next_retry_at, priority,
//                      pre_dial_status, last_disposition, last_gateway_id,
//                      status_changed_at, completed_at (+ hot-path indexes).
//   3. campaigns     — pacing/rule columns: dial_ratio, dial_timeout_sec,
//                      wrapup_seconds, lead_order, callbacks_enabled,
//                      max_abandon_pct, recording_enabled.
//   4. calls         — becomes the full call-history table: list_id,
//                      gateway_id, answered_at, hangup_cause, disposition,
//                      lead_status, dial_source, channel_id, ring_seconds,
//                      attempt_no; employee_id becomes NULLable (an attempt
//                      that never reached an agent still gets a row) and the
//                      status ENUM gains dialing/ringing/cancelled/abandoned.
//   5. gsm_gateways  — load balancing + health: priority, reachable,
//                      last_ok_at, last_fail_at, fail_count.
//   6. scheduled_calls — becomes the callback queue: csv_data_id,
//                      campaign_id, list_id, callback_type, and assigned_to
//                      becomes NULLable (campaign-wide callbacks).
//   7. Backfills: lead statuses normalised to the canonical UPPERCASE
//      vocabulary, dial rules defaulted, engine settings seeded.
//
//  The database collation is case-insensitive (utf8mb4_*_ci), so campaigns
//  that stored lowercase statuses ("no_answer") keep matching after the
//  normalisation — no campaign reconfiguration is needed.
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

// ---- introspection helpers ------------------------------------------------

async function columnExists(table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [DB_NAME, table, column],
  );
  return Number(rows[0].c) > 0;
}

async function columnMeta(table, column) {
  const [rows] = await conn.query(
    `SELECT COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [DB_NAME, table, column],
  );
  return rows[0] ?? null;
}

async function indexExists(table, index) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [DB_NAME, table, index],
  );
  return Number(rows[0].c) > 0;
}

async function tableExists(table) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [DB_NAME, table],
  );
  return Number(rows[0].c) > 0;
}

/** ADD COLUMN when it is missing. `spec` is everything after the column name. */
async function addColumn(table, column, spec) {
  if (await columnExists(table, column)) return false;
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${spec}`);
  console.log(`OK  ${table}.${column} added`);
  return true;
}

async function addIndex(table, index, cols) {
  if (await indexExists(table, index)) return false;
  await conn.query(`ALTER TABLE \`${table}\` ADD INDEX \`${index}\` (${cols})`);
  console.log(`OK  ${table}.${index} index added`);
  return true;
}

// ---- 1. new tables --------------------------------------------------------

await conn.query(readFileSync(join(here, 'migrations', '005-vicidial-dialer.sql'), 'utf8'));
console.log('OK  dialer_log + pending_recordings tables ready');

// The lists layer is a hard prerequisite (every lead must belong to a list).
if (!(await tableExists('lists'))) {
  console.error('FAIL  the `lists` table is missing — run `npm run db:migrate:lists` first');
  await conn.end();
  process.exit(1);
}

// ---- 2. csv_data: the lead lifecycle --------------------------------------

await addColumn(
  'csv_data',
  'next_retry_at',
  "DATETIME NULL COMMENT 'Redial queue: the lead is not claimable before this time' AFTER recycle_attempts",
);
await addColumn(
  'csv_data',
  'priority',
  "INT NOT NULL DEFAULT 0 COMMENT 'Higher dials first (callbacks are injected with a high priority)' AFTER next_retry_at",
);
await addColumn(
  'csv_data',
  'pre_dial_status',
  "VARCHAR(32) NULL COMMENT 'Status the lead held before it was QUEUED — restored when a reservation expires' AFTER priority",
);
await addColumn(
  'csv_data',
  'last_disposition',
  "VARCHAR(32) NULL COMMENT 'Agent disposition code from the last wrap-up (PTP, PAID, CB, ...)' AFTER pre_dial_status",
);
await addColumn(
  'csv_data',
  'last_gateway_id',
  'INT NULL COMMENT \'gsm_gateways.id used for the last attempt\' AFTER last_disposition',
);
await addColumn(
  'csv_data',
  'status_changed_at',
  'DATETIME NULL COMMENT \'When call_status last changed\' AFTER last_gateway_id',
);
await addColumn(
  'csv_data',
  'completed_at',
  "DATETIME NULL COMMENT 'Set when the lead reaches a terminal status (COMPLETED / WRONG_NUMBER / DNC)' AFTER status_changed_at",
);

// Hot paths: the claim SELECT (campaign + list + status + retry time) and the
// stale-claim sweeper (claimed_at across all campaigns).
await addIndex('csv_data', 'idx_csv_dial', 'campaign_id, call_status, next_retry_at');
await addIndex('csv_data', 'idx_csv_list_status', 'list_id, call_status');
await addIndex('csv_data', 'idx_csv_claimed', 'claimed_at');
await addIndex('csv_data', 'idx_csv_priority', 'campaign_id, priority');

// ---- 3. campaigns: pacing + rules ----------------------------------------

await addColumn(
  'campaigns',
  'dial_ratio',
  "DECIMAL(4,2) NOT NULL DEFAULT 1.00 COMMENT 'Lines dialled per READY agent (1.00 = progressive, >1 over-dials)'",
);
await addColumn(
  'campaigns',
  'dial_timeout_sec',
  "INT NOT NULL DEFAULT 45 COMMENT 'Seconds to let the customer leg ring before giving up'",
);
await addColumn(
  'campaigns',
  'wrapup_seconds',
  "INT NOT NULL DEFAULT 0 COMMENT 'Grace period after a call before the agent is offered another (0 = until the agent saves)'",
);
await addColumn(
  'campaigns',
  'lead_order',
  "ENUM('oldest','newest','priority','random') NOT NULL DEFAULT 'oldest' COMMENT 'Order leads are claimed in'",
);
await addColumn(
  'campaigns',
  'callbacks_enabled',
  "TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Feed due scheduled_calls back into the dial queue'",
);
await addColumn(
  'campaigns',
  'max_abandon_pct',
  "DECIMAL(5,2) NOT NULL DEFAULT 3.00 COMMENT 'Over-dialling is throttled when the abandon rate exceeds this'",
);
await addColumn(
  'campaigns',
  'recording_enabled',
  'TINYINT(1) NOT NULL DEFAULT 0',
);

// retry_count / retry_delay_minutes already exist and were unused. They now
// carry meaning, documented in the column comment so nobody re-purposes them.
await conn.query(
  `ALTER TABLE campaigns
     MODIFY retry_count INT NOT NULL DEFAULT 0
       COMMENT 'Max total dial attempts per lead; 0 = unlimited (recycle rules decide)'`,
);
await conn.query(
  `ALTER TABLE campaigns
     MODIFY retry_delay_minutes INT NOT NULL DEFAULT 60
       COMMENT 'Fallback retry delay used when a recycle rule omits delay_min'`,
);
console.log('OK  campaigns.retry_count / retry_delay_minutes documented');

// ---- 4. calls: the call-history table ------------------------------------

// An attempt that never reached an agent (no answer, busy, abandoned) still
// gets a history row, so employee_id must accept NULL.
const empMeta = await columnMeta('calls', 'employee_id');
if (empMeta && empMeta.IS_NULLABLE === 'NO') {
  // Drop the FK first — MySQL will not MODIFY a column under an active FK
  // constraint that would change its nullability semantics on some versions.
  const [fks] = await conn.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'calls' AND COLUMN_NAME = 'employee_id'
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [DB_NAME],
  );
  for (const fk of fks) {
    await conn.query(`ALTER TABLE calls DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
  }
  await conn.query(
    `ALTER TABLE calls MODIFY employee_id INT NULL
       COMMENT 'Agent who handled the call; NULL = attempt that never reached an agent'`,
  );
  await conn.query(
    `ALTER TABLE calls ADD CONSTRAINT fk_calls_employee
       FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE`,
  );
  console.log('OK  calls.employee_id is now NULLable (agent-less attempts)');
}

const statusMeta = await columnMeta('calls', 'status');
if (statusMeta && !statusMeta.COLUMN_TYPE.includes("'dialing'")) {
  await conn.query(
    `ALTER TABLE calls MODIFY status
       ENUM('dialing','ringing','connected','no_answer','busy','failed',
            'voicemail','wrong_number','cancelled','abandoned','completed')
       NOT NULL DEFAULT 'dialing'`,
  );
  console.log('OK  calls.status ENUM extended (dialing/ringing/cancelled/abandoned)');
}

await addColumn('calls', 'list_id', 'INT NULL AFTER csv_data_id');
await addColumn('calls', 'gateway_id', "INT NULL COMMENT 'gsm_gateways.id the attempt went out on' AFTER list_id");
await addColumn('calls', 'answered_at', 'DATETIME NULL AFTER started_at');
await addColumn('calls', 'ring_seconds', "INT NOT NULL DEFAULT 0 COMMENT 'Seconds between dial and answer' AFTER duration_seconds");
await addColumn('calls', 'hangup_cause', "VARCHAR(64) NULL COMMENT 'Asterisk hangup cause / internal reason' AFTER ended_at");
await addColumn('calls', 'disposition', "VARCHAR(32) NULL COMMENT 'Agent disposition code (PTP, PAID, CB, ...)' AFTER hangup_cause");
await addColumn('calls', 'lead_status', "VARCHAR(32) NULL COMMENT 'Lead status this attempt produced' AFTER disposition");
await addColumn(
  'calls',
  'dial_source',
  "ENUM('manual','predictive','ratio','inbound','callback') NOT NULL DEFAULT 'manual' AFTER direction",
);
await addColumn('calls', 'channel_id', "VARCHAR(80) NULL COMMENT 'ARI channel id of the customer leg' AFTER lead_status");
await addColumn('calls', 'attempt_no', "INT NOT NULL DEFAULT 0 COMMENT 'csv_data.call_count at the time of this attempt' AFTER dial_source");

await addIndex('calls', 'idx_calls_campaign_created', 'campaign_id, created_at');
await addIndex('calls', 'idx_calls_gateway_created', 'gateway_id, created_at');
await addIndex('calls', 'idx_calls_channel', 'channel_id');
await addIndex('calls', 'idx_calls_csv_created', 'csv_data_id, created_at');

// ---- 5. gsm_gateways: balancing + health ---------------------------------

await addColumn(
  'gsm_gateways',
  'priority',
  "INT NOT NULL DEFAULT 0 COMMENT 'Higher priority gateways are filled first; ties break on least-loaded'",
);
await addColumn(
  'gsm_gateways',
  'reachable',
  "TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Live health from Asterisk; the dialer skips 0'",
);
await addColumn('gsm_gateways', 'last_ok_at', 'DATETIME NULL');
await addColumn('gsm_gateways', 'last_fail_at', 'DATETIME NULL');
await addColumn(
  'gsm_gateways',
  'fail_count',
  "INT NOT NULL DEFAULT 0 COMMENT 'Consecutive originate failures; reset on success'",
);

// ---- 6. scheduled_calls: the callback queue ------------------------------

await addColumn('scheduled_calls', 'csv_data_id', 'INT NULL AFTER call_note_id');
await addColumn('scheduled_calls', 'campaign_id', 'INT NULL AFTER csv_data_id');
await addColumn('scheduled_calls', 'list_id', 'INT NULL AFTER campaign_id');
await addColumn(
  'scheduled_calls',
  'callback_type',
  "ENUM('agent','campaign') NOT NULL DEFAULT 'agent' COMMENT \"agent = only the booking agent may take it; campaign = any agent on the campaign\" AFTER assigned_to",
);

const schedAssigned = await columnMeta('scheduled_calls', 'assigned_to');
if (schedAssigned && schedAssigned.IS_NULLABLE === 'NO') {
  const [fks] = await conn.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'scheduled_calls' AND COLUMN_NAME = 'assigned_to'
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [DB_NAME],
  );
  for (const fk of fks) {
    await conn.query(`ALTER TABLE scheduled_calls DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
  }
  await conn.query(
    `ALTER TABLE scheduled_calls MODIFY assigned_to INT NULL
       COMMENT 'Booking agent; NULL = campaign-wide callback any agent may take'`,
  );
  await conn.query(
    `ALTER TABLE scheduled_calls ADD CONSTRAINT fk_sched_assigned
       FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE`,
  );
  console.log('OK  scheduled_calls.assigned_to is now NULLable (campaign callbacks)');
}
await addIndex('scheduled_calls', 'idx_sched_due', 'status, scheduled_at');
await addIndex('scheduled_calls', 'idx_sched_campaign', 'campaign_id, status');
await addIndex('scheduled_calls', 'idx_sched_lead', 'csv_data_id');

// ---- 7. backfills ---------------------------------------------------------

// 7a. Canonical UPPERCASE lead statuses. The collation is case-insensitive so
// this changes only the stored spelling — every existing dial rule, report and
// GROUP BY keeps matching exactly as before.
const STATUS_MAP = {
  new: 'NEW',
  queued: 'QUEUED',
  dialing: 'DIALING',
  ringing: 'RINGING',
  connected: 'CONNECTED',
  busy: 'BUSY',
  no_answer: 'NO_ANSWER',
  noanswer: 'NO_ANSWER',
  na: 'NO_ANSWER',
  failed: 'FAILED',
  voicemail: 'VOICEMAIL',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
  abandoned: 'CANCELLED',
  completed: 'COMPLETED',
  wrong_number: 'WRONG_NUMBER',
  wrongnumber: 'WRONG_NUMBER',
  dnc: 'DNC',
};
let normalised = 0;
for (const [from, to] of Object.entries(STATUS_MAP)) {
  const [r] = await conn.query(
    'UPDATE csv_data SET call_status = ? WHERE call_status = ? AND BINARY call_status <> ?',
    [to, from, to],
  );
  normalised += r.affectedRows;
}
if (normalised > 0) console.log(`OK  ${normalised} lead statuses normalised to UPPERCASE`);

// Any status not in the map (a custom disposition someone wrote directly) is
// left exactly as-is — uppercasing an unknown value could break a dial rule.

// 7b. status_changed_at for leads that already carry a status.
const [sc] = await conn.query(
  `UPDATE csv_data SET status_changed_at = COALESCE(last_call_at, created_at)
    WHERE status_changed_at IS NULL`,
);
if (sc.affectedRows > 0) console.log(`OK  status_changed_at backfilled on ${sc.affectedRows} leads`);

// 7c. A lead that was dialled but whose status never advanced past NEW is the
// exact bug this migration removes. Park those on FAILED so they re-enter the
// redial queue instead of looking "never dialled".
const [stranded] = await conn.query(
  `UPDATE csv_data
      SET call_status = 'FAILED', status_changed_at = NOW()
    WHERE called = 1 AND call_status = 'NEW'`,
);
if (stranded.affectedRows > 0) {
  console.log(`OK  ${stranded.affectedRows} stranded leads (called=1 but status NEW) moved to FAILED`);
}

// 7d. Release any claim left behind by an older process.
const [rel] = await conn.query(
  `UPDATE csv_data SET claimed_at = NULL, assigned_to = NULL
    WHERE claimed_at IS NOT NULL AND claimed_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
);
if (rel.affectedRows > 0) console.log(`OK  ${rel.affectedRows} stale claims released`);

// 7e. Existing call rows describe finished calls — backfill the new columns
// from what is already known so reports are complete from day one.
const [bf] = await conn.query(
  `UPDATE calls c
      LEFT JOIN csv_data d ON d.id = c.csv_data_id
      SET c.list_id     = COALESCE(c.list_id, d.list_id),
          c.answered_at = COALESCE(c.answered_at,
                            CASE WHEN c.status = 'connected' THEN c.started_at END),
          c.lead_status = COALESCE(c.lead_status, UPPER(c.status))
    WHERE c.list_id IS NULL OR c.lead_status IS NULL`,
);
if (bf.affectedRows > 0) console.log(`OK  ${bf.affectedRows} historic call rows backfilled`);

// 7f. Dial rules defaults for campaigns created before the rules existed.
const DEFAULT_DIAL_STATUSES = ['NEW', 'NO_ANSWER', 'BUSY'];
const DEFAULT_RECYCLE_RULES = [
  { status: 'NO_ANSWER', delay_min: 60, max_attempts: 3 },
  { status: 'BUSY', delay_min: 30, max_attempts: 3 },
  { status: 'FAILED', delay_min: 30, max_attempts: 2 },
  { status: 'CANCELLED', delay_min: 15, max_attempts: 2 },
];
const [ds] = await conn.query('UPDATE campaigns SET dial_statuses = ? WHERE dial_statuses IS NULL', [
  JSON.stringify(DEFAULT_DIAL_STATUSES),
]);
if (ds.affectedRows > 0) console.log(`OK  dial_statuses defaulted on ${ds.affectedRows} campaigns`);
const [rr] = await conn.query('UPDATE campaigns SET recycle_rules = ? WHERE recycle_rules IS NULL', [
  JSON.stringify(DEFAULT_RECYCLE_RULES),
]);
if (rr.affectedRows > 0) console.log(`OK  recycle_rules defaulted on ${rr.affectedRows} campaigns`);

// 7g. Engine tunables. INSERT IGNORE keeps an operator's existing values.
const SETTINGS = [
  ['predictive_ratio', '1'],
  ['phone_cooldown_seconds', '60'],
  ['dialer_claim_timeout_sec', '120'],
  ['dialer_oncall_timeout_sec', '1800'],
  ['dialer_tick_ms', '1000'],
  ['dialer_wrapup_timeout_sec', '900'],
  ['dialer_ringing_timeout_sec', '90'],
  ['dialer_gateway_health_sec', '20'],
  ['dialer_gateway_fail_threshold', '3'],
  ['dialer_gateway_cooldown_sec', '60'],
  ['dialer_max_abandon_pct', '3'],
  ['dialer_callback_lookahead_min', '5'],
  ['dialer_enabled', '1'],
  // Answering-machine detection. Turn on only after adding the
  // [predictive-amd] context from asterisk-config/extensions.conf.
  ['dialer_amd_enabled', '0'],
  ['dialer_amd_context', 'predictive-amd'],
];
for (const [k, v] of SETTINGS) {
  await conn.query('INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?,?)', [k, v]);
}
console.log('OK  dialer settings seeded (existing values preserved)');

// ---- summary --------------------------------------------------------------

const [[counts]] = await conn.query(
  `SELECT (SELECT COUNT(*) FROM csv_data)                              AS leads,
          (SELECT COUNT(*) FROM csv_data WHERE called = 1 AND call_status = 'NEW') AS stranded,
          (SELECT COUNT(*) FROM lists WHERE active = 'Y')              AS activeLists,
          (SELECT COUNT(*) FROM campaigns WHERE status = 'active')     AS activeCampaigns,
          (SELECT COUNT(*) FROM gsm_gateways WHERE status = 'active')  AS activeGateways`,
);
console.log(
  `DONE  leads=${counts.leads} strandedNEW=${counts.stranded} (must be 0) ` +
    `activeLists=${counts.activeLists} activeCampaigns=${counts.activeCampaigns} ` +
    `activeGateways=${counts.activeGateways}`,
);
if (Number(counts.stranded) > 0) process.exitCode = 1;

await conn.end();

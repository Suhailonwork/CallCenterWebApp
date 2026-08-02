-- =====================================================================
--  Call Center Platform — complete MySQL schema (single source of truth)
--
--  Run with:  npm run db:migrate   (executes db/migrate.mjs)
--  WARNING: drops and recreates every table.
--
--  This file consolidates what used to live across many migration files
--  (autodialer tables, GSM gateways, CSV claim columns, dialer types,
--  agent sessions and the Asterisk PJSIP realtime tables). It is the only
--  schema file the project needs.
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS dialer_log;
DROP TABLE IF EXISTS pending_recordings;
DROP TABLE IF EXISTS ps_endpoint_id_ips;
DROP TABLE IF EXISTS ps_endpoints;
DROP TABLE IF EXISTS ps_auths;
DROP TABLE IF EXISTS ps_aors;
DROP TABLE IF EXISTS attendance_sessions;
DROP TABLE IF EXISTS shifts;
DROP TABLE IF EXISTS agent_sessions;
DROP TABLE IF EXISTS campaign_gateways;
DROP TABLE IF EXISTS gsm_gateways;
DROP TABLE IF EXISTS campaign_assignments;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS performance;
DROP TABLE IF EXISTS breaks;
DROP TABLE IF EXISTS scheduled_calls;
DROP TABLE IF EXISTS call_notes;
DROP TABLE IF EXISTS calls;
DROP TABLE IF EXISTS csv_data;
DROP TABLE IF EXISTS lists;
DROP TABLE IF EXISTS data_tables;
DROP TABLE IF EXISTS campaigns;
DROP TABLE IF EXISTS group_agents;
DROP TABLE IF EXISTS group_tl;
DROP TABLE IF EXISTS `groups`;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- ---- users: every account (admin / manager / tl / employee) ----
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','manager','tl','employee') NOT NULL,
  team_id       INT NULL,
  shift_id      INT NULL,
  reports_to    INT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_team (team_id),
  INDEX idx_users_shift (shift_id),
  INDEX idx_users_reports_to (reports_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- teams: a TL + their employees, owned by a manager ----
CREATE TABLE teams (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  manager_id INT NULL,
  tl_id      INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_teams_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_teams_tl      FOREIGN KEY (tl_id)      REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE users
  ADD CONSTRAINT fk_users_team       FOREIGN KEY (team_id)    REFERENCES teams(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_users_reports_to FOREIGN KEY (reports_to) REFERENCES users(id) ON DELETE SET NULL;

-- ---- employees: extra profile fields for employee-role users ----
CREATE TABLE employees (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL UNIQUE,
  sip_extension VARCHAR(32) NOT NULL,
  sip_password  VARCHAR(64) NOT NULL,
  status        ENUM('offline','available','on_call','break') NOT NULL DEFAULT 'offline',
  break_status  VARCHAR(32) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- groups: a named unit of TLs + agents that owns campaigns ----
-- NOTE: `groups` is a reserved word in MySQL 8 — always backtick it.
CREATE TABLE `groups` (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(500) NULL,
  created_by  INT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_groups_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- group_tl: which Team Leads run a group (a group can have several) ----
CREATE TABLE group_tl (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  group_id   INT NOT NULL,
  tl_id      INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_group_tl (group_id, tl_id),
  CONSTRAINT fk_gtl_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  CONSTRAINT fk_gtl_user  FOREIGN KEY (tl_id)    REFERENCES users(id)    ON DELETE CASCADE,
  INDEX idx_gtl_tl (tl_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- group_agents: which agents belong to a group ----
CREATE TABLE group_agents (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  group_id   INT NOT NULL,
  agent_id   INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_group_agent (group_id, agent_id),
  CONSTRAINT fk_ga_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  CONSTRAINT fk_ga_user  FOREIGN KEY (agent_id) REFERENCES users(id)    ON DELETE CASCADE,
  INDEX idx_ga_agent (agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- campaigns: a calling campaign (RULES only — leads live in lists) ----
CREATE TABLE campaigns (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  name                VARCHAR(150) NOT NULL,
  description         TEXT NULL,
  script              TEXT NULL,
  created_by          INT NULL,
  group_id            INT NULL,
  data_table_id       INT NULL COMMENT 'Optional reusable Data Table that defines which CSV columns are stored in csv_data.custom_fields',
  status              ENUM('active','paused','completed') NOT NULL DEFAULT 'active',
  dialer_type         ENUM('predictive','manual','inbound','ratio') NOT NULL DEFAULT 'manual',
  calling_start       TIME NULL COMMENT 'Start of the allowed calling window (NULL = always)',
  calling_end         TIME NULL COMMENT 'End of the allowed calling window (may wrap past midnight)',
  retry_count         INT NOT NULL DEFAULT 0
                        COMMENT 'Max total dial attempts per lead; 0 = unlimited (recycle rules decide)',
  retry_delay_minutes INT NOT NULL DEFAULT 60
                        COMMENT 'Fallback retry delay used when a recycle rule omits delay_min',
  dial_statuses       JSON NULL COMMENT 'Lead statuses the dialer may claim (JSON array); NULL = default NEW/NO_ANSWER/BUSY',
  recycle_rules       JSON NULL COMMENT 'Auto-retry rules: [{status, delay_min, max_attempts}]; NULL/[] = no recycling',
  -- ---- pacing (VICIdial-style predictive control) ----
  dial_ratio          DECIMAL(4,2) NOT NULL DEFAULT 1.00
                        COMMENT 'Lines dialled per READY agent (1.00 = progressive, >1 over-dials)',
  dial_timeout_sec    INT NOT NULL DEFAULT 45
                        COMMENT 'Seconds to let the customer leg ring before giving up',
  wrapup_seconds      INT NOT NULL DEFAULT 0
                        COMMENT 'Grace period after a call before the agent is offered another (0 = until saved)',
  lead_order          ENUM('oldest','newest','priority','random') NOT NULL DEFAULT 'oldest'
                        COMMENT 'Order leads are claimed in',
  callbacks_enabled   TINYINT(1) NOT NULL DEFAULT 1
                        COMMENT 'Feed due scheduled_calls back into the dial queue',
  max_abandon_pct     DECIMAL(5,2) NOT NULL DEFAULT 3.00
                        COMMENT 'Over-dialling is throttled when the abandon rate exceeds this',
  recording_enabled   TINYINT(1) NOT NULL DEFAULT 0,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_campaigns_creator FOREIGN KEY (created_by) REFERENCES users(id)    ON DELETE SET NULL,
  CONSTRAINT fk_campaigns_group   FOREIGN KEY (group_id)   REFERENCES `groups`(id) ON DELETE SET NULL,
  INDEX idx_campaigns_status (status),
  INDEX idx_campaigns_group (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- data_tables: reusable, ordered column-name sets for CSV uploads ----
-- A list (or, legacy, a campaign) may reference one data_table; on CSV upload
-- only that table's columns (in order) are stored into csv_data.custom_fields.
-- No per-table SQL tables are ever created — the actual cell values live in
-- the existing JSON column. (Defined before lists/csv_data for the FKs.)
CREATE TABLE data_tables (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  columns    JSON NOT NULL COMMENT 'Ordered array of column names',
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_data_tables_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- lists: a data container of leads, owned by one campaign ----
-- VICIdial-style: campaign = rules, list = data with an ON/OFF switch.
-- The dialer only claims leads from lists with active='Y'.
CREATE TABLE lists (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  description VARCHAR(500) NULL,
  campaign_id INT NOT NULL,
  active      ENUM('Y','N') NOT NULL DEFAULT 'N',
  template_id INT NULL COMMENT 'Legacy: Data Template (data_tables.id); superseded by fields',
  fields      JSON NULL COMMENT 'Ordered custom field names stored from CSV uploads; NULL/[] = store all columns',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lists_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id)   ON DELETE CASCADE,
  CONSTRAINT fk_lists_template FOREIGN KEY (template_id) REFERENCES data_tables(id) ON DELETE SET NULL,
  -- One list name per campaign — also stops a check-then-insert race from
  -- creating two "Default List" rows for the same campaign.
  UNIQUE KEY uq_lists_campaign_name (campaign_id, name),
  INDEX idx_lists_campaign_active (campaign_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- csv_data: uploaded leads; every lead belongs to a list ----
-- campaign_id is kept in sync with the list's campaign (denormalized for the
-- claim hot path and for legacy queries).
CREATE TABLE csv_data (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id      INT NOT NULL,
  list_id          INT NULL,
  phone_number     VARCHAR(32) NOT NULL,
  name             VARCHAR(150) NULL,
  email            VARCHAR(180) NULL,
  company          VARCHAR(150) NULL,
  custom_fields    JSON NULL,
  called            TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'called_since_last_reset: 1 after a dial, back to 0 on list RESET',
  call_status       VARCHAR(32) NOT NULL DEFAULT 'NEW'
                      COMMENT 'Lifecycle status: NEW QUEUED DIALING RINGING CONNECTED BUSY NO_ANSWER FAILED VOICEMAIL CANCELLED CALLBACK WRONG_NUMBER DNC COMPLETED',
  call_count        INT NOT NULL DEFAULT 0
                      COMMENT 'Dial attempts since the last list RESET; the campaign attempt cap is measured against this. Permanent per-attempt history lives in `calls`.',
  last_call_at      DATETIME NULL,
  recycle_attempts  INT NOT NULL DEFAULT 0,
  next_retry_at     DATETIME NULL COMMENT 'Redial queue: the lead is not claimable before this time',
  priority          INT NOT NULL DEFAULT 0 COMMENT 'Higher dials first (due callbacks are injected at 100)',
  pre_dial_status   VARCHAR(32) NULL COMMENT 'Status held before QUEUED — restored when a reservation expires',
  last_disposition  VARCHAR(32) NULL COMMENT 'Agent disposition code from the last wrap-up (PTP, PAID, CB, ...)',
  last_gateway_id   INT NULL COMMENT 'gsm_gateways.id used for the last attempt',
  status_changed_at DATETIME NULL,
  completed_at      DATETIME NULL COMMENT 'Set when the lead reaches a terminal status',
  assigned_to       INT NULL,
  claimed_at        DATETIME NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_csv_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_csv_list     FOREIGN KEY (list_id)     REFERENCES lists(id)     ON DELETE CASCADE,
  CONSTRAINT fk_csv_assigned FOREIGN KEY (assigned_to) REFERENCES users(id)     ON DELETE SET NULL,
  -- Hot path: the auto-dialer claims "the next dialable lead in an active list".
  INDEX idx_csv_campaign_called (campaign_id, called),
  INDEX idx_csv_list_called (list_id, called),
  INDEX idx_csv_assigned (assigned_to),
  INDEX idx_csv_dial (campaign_id, call_status, next_retry_at),
  INDEX idx_csv_list_status (list_id, call_status),
  INDEX idx_csv_claimed (claimed_at),
  INDEX idx_csv_priority (campaign_id, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- calls: the call-history table — ONE row per dial attempt ----
-- Opened the moment the attempt goes out (status 'dialing') and closed when it
-- hangs up, so unanswered attempts are recorded too. employee_id is NULL for a
-- predictive attempt that never reached an agent.
CREATE TABLE calls (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  employee_id      INT NULL COMMENT 'Agent who handled the call; NULL = attempt that never reached an agent',
  campaign_id      INT NULL,
  csv_data_id      INT NULL,
  list_id          INT NULL,
  gateway_id       INT NULL COMMENT 'gsm_gateways.id the attempt went out on',
  phone_number     VARCHAR(32) NOT NULL,
  contact_name     VARCHAR(150) NULL,
  direction        ENUM('inbound','outbound') NOT NULL DEFAULT 'outbound',
  dial_source      ENUM('manual','predictive','ratio','inbound','callback') NOT NULL DEFAULT 'manual',
  attempt_no       INT NOT NULL DEFAULT 0 COMMENT 'csv_data.call_count at the time of this attempt',
  status           ENUM('dialing','ringing','connected','no_answer','busy','failed',
                        'voicemail','wrong_number','cancelled','abandoned','completed')
                     NOT NULL DEFAULT 'dialing',
  duration_seconds INT NOT NULL DEFAULT 0 COMMENT 'Talk time; 0 when the customer never answered',
  ring_seconds     INT NOT NULL DEFAULT 0 COMMENT 'Seconds between dial and answer',
  started_at       DATETIME NULL,
  answered_at      DATETIME NULL,
  ended_at         DATETIME NULL,
  hangup_cause     VARCHAR(64) NULL COMMENT 'Asterisk hangup cause / internal reason',
  disposition      VARCHAR(32) NULL COMMENT 'Agent disposition code (PTP, PAID, CB, ...)',
  lead_status      VARCHAR(32) NULL COMMENT 'Lead status this attempt produced',
  channel_id       VARCHAR(80) NULL COMMENT 'ARI channel id of the customer leg',
  recording_url    VARCHAR(255) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_calls_employee FOREIGN KEY (employee_id) REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_calls_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  CONSTRAINT fk_calls_csv      FOREIGN KEY (csv_data_id) REFERENCES csv_data(id)  ON DELETE SET NULL,
  INDEX idx_calls_employee_created (employee_id, created_at),
  INDEX idx_calls_campaign_created (campaign_id, created_at),
  INDEX idx_calls_gateway_created (gateway_id, created_at),
  INDEX idx_calls_csv_created (csv_data_id, created_at),
  INDEX idx_calls_channel (channel_id),
  INDEX idx_calls_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- call_notes: post-call notes / disposition tags ----
CREATE TABLE call_notes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  call_id      INT NOT NULL,
  employee_id  INT NOT NULL,
  note         TEXT NULL,
  tags         VARCHAR(255) NULL,
  follow_up_at DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notes_call     FOREIGN KEY (call_id)     REFERENCES calls(id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- scheduled_calls: the callback queue ----
-- A due row is injected back into the dial queue by the predictive engine:
-- the lead moves to CALLBACK with priority 100, so it dials next.
CREATE TABLE scheduled_calls (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  call_note_id  INT NULL,
  csv_data_id   INT NULL,
  campaign_id   INT NULL,
  list_id       INT NULL,
  phone_number  VARCHAR(32) NOT NULL,
  contact_name  VARCHAR(150) NULL,
  scheduled_at  DATETIME NOT NULL,
  assigned_to   INT NULL COMMENT 'Booking agent; NULL = campaign-wide callback any agent may take',
  callback_type ENUM('agent','campaign') NOT NULL DEFAULT 'agent',
  status        ENUM('pending','done','missed','cancelled') NOT NULL DEFAULT 'pending',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sched_note     FOREIGN KEY (call_note_id) REFERENCES call_notes(id) ON DELETE SET NULL,
  CONSTRAINT fk_sched_assigned FOREIGN KEY (assigned_to)  REFERENCES users(id)      ON DELETE CASCADE,
  INDEX idx_sched_assigned_status (assigned_to, status),
  INDEX idx_sched_due (status, scheduled_at),
  INDEX idx_sched_campaign (campaign_id, status),
  INDEX idx_sched_lead (csv_data_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- breaks: break / lunch requests ----
CREATE TABLE breaks (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  break_type  ENUM('lunch','short','other') NOT NULL DEFAULT 'short',
  reason      VARCHAR(255) NULL,
  status      ENUM('requested','approved','denied','active','completed') NOT NULL DEFAULT 'requested',
  start_time  DATETIME NULL,
  end_time    DATETIME NULL,
  approved_by INT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_breaks_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_breaks_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_breaks_employee_status (employee_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- performance: daily rollup per employee ----
CREATE TABLE performance (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  employee_id            INT NOT NULL,
  date                   DATE NOT NULL,
  calls_made             INT NOT NULL DEFAULT 0,
  calls_connected        INT NOT NULL DEFAULT 0,
  success_rate           DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_duration_seconds INT NOT NULL DEFAULT 0,
  break_duration_seconds INT NOT NULL DEFAULT 0,
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_perf_emp_date (employee_id, date),
  CONSTRAINT fk_perf_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- audit_logs: security-relevant actions (who did what, from where) ----
CREATE TABLE audit_logs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NULL,
  action     VARCHAR(100) NOT NULL,
  entity     VARCHAR(60) NULL,
  entity_id  INT NULL,
  details    JSON NULL,
  ip         VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_entity (entity, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- settings: system configuration (key/value) ----
CREATE TABLE settings (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  setting_key   VARCHAR(80) NOT NULL UNIQUE,
  setting_value VARCHAR(255) NOT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- campaign_assignments: which agents work which campaign ----
CREATE TABLE campaign_assignments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,
  employee_id INT NOT NULL,
  assigned_by INT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_assignment (campaign_id, employee_id),
  CONSTRAINT fk_ca_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_ca_employee FOREIGN KEY (employee_id) REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_ca_assigner FOREIGN KEY (assigned_by) REFERENCES users(id)     ON DELETE SET NULL,
  INDEX idx_ca_employee (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- gsm_gateways: physical GSM/VoIP gateway devices ----
-- `channels` is a hard cap on concurrent calls the dialer will put through this
-- gateway; `priority` and the live channel count drive load balancing, and
-- `reachable` / `fail_count` drive automatic failover.
CREATE TABLE gsm_gateways (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  ip                VARCHAR(64)  NOT NULL,
  port              SMALLINT UNSIGNED NOT NULL DEFAULT 5060,
  channels          SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Max concurrent calls (SIM/GSM channels); 0 = uncapped',
  status            ENUM('active','inactive') NOT NULL DEFAULT 'active',
  asterisk_endpoint VARCHAR(100) NULL COMMENT 'PJSIP endpoint name in Asterisk, e.g. gw1',
  priority          INT NOT NULL DEFAULT 0 COMMENT 'Higher priority gateways fill first; ties break on least-loaded',
  reachable         TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Live health from Asterisk; the dialer skips 0',
  last_ok_at        DATETIME NULL,
  last_fail_at      DATETIME NULL,
  fail_count        INT NOT NULL DEFAULT 0 COMMENT 'Consecutive originate failures; reset on success',
  notes             VARCHAR(255) NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_gw_status (status, reachable, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- campaign_gateways: which gateways are assigned to a campaign ----
CREATE TABLE campaign_gateways (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,
  gateway_id  INT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cg (campaign_id, gateway_id),
  KEY fk_cg_gateway (gateway_id),
  CONSTRAINT fk_cg_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id)    ON DELETE CASCADE,
  CONSTRAINT fk_cg_gateway  FOREIGN KEY (gateway_id)  REFERENCES gsm_gateways(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- agent_sessions: agent login / logout times (login-hours tracking) ----
CREATE TABLE agent_sessions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  login_at    DATETIME NOT NULL,
  logout_at   DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_agent_sessions_emp (employee_id, login_at),
  CONSTRAINT fk_agent_sessions_user FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- dialer_log: the per-lead event trail (selected -> … -> completed) ----
-- Deliberately has NO foreign keys: a log row must never block or cascade with
-- the lead/call it describes, and it must survive a list or campaign delete.
CREATE TABLE dialer_log (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  csv_data_id INT NULL,
  campaign_id INT NULL,
  list_id     INT NULL,
  call_id     INT NULL,
  agent_id    INT NULL,
  gateway_id  INT NULL,
  event       VARCHAR(40) NOT NULL
                COMMENT 'selected|reserved|dial_started|ringing|answered|connected|abandoned|failed|retry_scheduled|retry_attempt|disposition|completed|released|recovered|callback_queued|gateway_up|gateway_down',
  status_from VARCHAR(32) NULL,
  status_to   VARCHAR(32) NULL,
  detail      JSON NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_dl_lead (csv_data_id, id),
  INDEX idx_dl_campaign (campaign_id, created_at),
  INDEX idx_dl_event (event, created_at),
  INDEX idx_dl_call (call_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- pending_recordings: bridge recordings waiting to be linked to a call ----
CREATE TABLE pending_recordings (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  extension    VARCHAR(20) NOT NULL,
  phone_number VARCHAR(32) NOT NULL,
  filename     VARCHAR(255) NOT NULL,
  consumed     TINYINT(1) NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_match (extension, phone_number, consumed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
--  Attendance & Login Tracking
--  Every login is one immutable row in attendance_sessions; shift / TL /
--  role are snapshot at login so historical records never change. The
--  calendar day is the IST (Asia/Kolkata) work_date computed by the app.
-- =====================================================================

-- ---- shifts: admin-defined shift windows employees are assigned to ----
CREATE TABLE shifts (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  grace_minutes INT NOT NULL DEFAULT 15,
  working_hours DECIMAL(4,2) NULL COMMENT 'Expected working hours; informational',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_by    INT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shifts_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_shifts_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- users.shift_id references shifts (added here to break the users<->shifts cycle).
ALTER TABLE users
  ADD CONSTRAINT fk_users_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;

-- ---- attendance_sessions: one row per login (the source of truth) ----
CREATE TABLE attendance_sessions (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  role             ENUM('admin','manager','tl','employee') NOT NULL,
  tl_id            INT NULL COMMENT 'Assigned TL (users.reports_to) snapshot at login',
  shift_id         INT NULL COMMENT 'Assigned shift snapshot at login',
  work_date        DATE NOT NULL COMMENT 'IST calendar day of the login',
  login_at         DATETIME NOT NULL COMMENT 'IST wall-clock login time',
  logout_at        DATETIME NULL COMMENT 'IST wall-clock logout time',
  duration_seconds INT NULL,
  status           ENUM('on_time','grace','late') NULL COMMENT 'Punctuality vs shift; NULL = no shift assigned',
  late_seconds     INT NOT NULL DEFAULT 0,
  logout_reason    ENUM('manual','timeout','force','expired') NULL,
  ip               VARCHAR(64) NULL,
  user_agent       VARCHAR(255) NULL,
  session_id       VARCHAR(64) NULL,
  last_seen_at     DATETIME NULL COMMENT 'Heartbeat — powers online detection & stale-session sweep',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_att_tl    FOREIGN KEY (tl_id)    REFERENCES users(id)  ON DELETE SET NULL,
  CONSTRAINT fk_att_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
  INDEX idx_att_user_date (user_id, work_date),
  INDEX idx_att_date_status (work_date, status),
  INDEX idx_att_shift (shift_id),
  INDEX idx_att_status (status),
  INDEX idx_att_open (logout_at),
  INDEX idx_att_tl_date (tl_id, work_date),
  INDEX idx_att_date_login (work_date, login_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
--  Asterisk PJSIP realtime tables
--  Asterisk reads these live (via res_pjsip + sorcery), so SIP endpoints
--  for employees and gateways are provisioned straight from the app
--  (see src/lib/asteriskRealtime.ts) with no pjsip.conf edits / reloads.
-- =====================================================================

-- ---- ps_aors: address-of-record objects ----
CREATE TABLE ps_aors (
  id                   VARCHAR(40) NOT NULL PRIMARY KEY,
  contact              VARCHAR(255) DEFAULT NULL,
  default_expiration   INT DEFAULT NULL,
  mailboxes            VARCHAR(80) DEFAULT NULL,
  max_contacts         SMALLINT DEFAULT NULL,
  minimum_expiration   INT DEFAULT NULL,
  remove_existing      ENUM('yes','no') DEFAULT NULL,
  qualify_frequency    INT DEFAULT NULL,
  authenticate_qualify ENUM('yes','no') DEFAULT NULL,
  maximum_expiration   INT DEFAULT NULL,
  outbound_proxy       VARCHAR(40) DEFAULT NULL,
  support_path         ENUM('yes','no') DEFAULT NULL,
  qualify_timeout      FLOAT DEFAULT NULL,
  voicemail_extension  VARCHAR(40) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- ps_auths: authentication objects ----
CREATE TABLE ps_auths (
  id             VARCHAR(40) NOT NULL PRIMARY KEY,
  auth_type      VARCHAR(40) DEFAULT NULL,
  nonce_lifetime SMALLINT DEFAULT NULL,
  md5_cred       VARCHAR(40) DEFAULT NULL,
  password       VARCHAR(80) DEFAULT NULL,
  realm          VARCHAR(40) DEFAULT NULL,
  username       VARCHAR(40) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- ps_endpoints: one row per SIP peer (employee WebRTC + gateways) ----
CREATE TABLE ps_endpoints (
  id                      VARCHAR(40) NOT NULL PRIMARY KEY,
  transport               VARCHAR(40) DEFAULT NULL,
  aors                    VARCHAR(200) DEFAULT NULL,
  auth                    VARCHAR(40) DEFAULT NULL,
  context                 VARCHAR(40) DEFAULT NULL,
  disallow                VARCHAR(200) DEFAULT 'all',
  allow                   VARCHAR(200) DEFAULT NULL,
  direct_media            ENUM('yes','no') DEFAULT NULL,
  dtmf_mode               VARCHAR(40) DEFAULT NULL,
  force_rport             ENUM('yes','no') DEFAULT NULL,
  ice_support             ENUM('yes','no') DEFAULT NULL,
  identify_by             VARCHAR(40) DEFAULT NULL,
  rewrite_contact         ENUM('yes','no') DEFAULT NULL,
  rtp_symmetric           ENUM('yes','no') DEFAULT NULL,
  media_encryption        VARCHAR(40) DEFAULT NULL,
  callerid                VARCHAR(40) DEFAULT NULL,
  from_user               VARCHAR(40) DEFAULT NULL,
  from_domain             VARCHAR(40) DEFAULT NULL,
  dtls_verify             VARCHAR(40) DEFAULT NULL,
  dtls_cert_file          VARCHAR(200) DEFAULT NULL,
  dtls_private_key        VARCHAR(200) DEFAULT NULL,
  dtls_setup              VARCHAR(40) DEFAULT NULL,
  dtls_auto_generate_cert ENUM('yes','no') DEFAULT NULL,
  srtp_tag_32             ENUM('yes','no') DEFAULT NULL,
  media_address           VARCHAR(40) DEFAULT NULL,
  set_var                 TEXT,
  accountcode             VARCHAR(80) DEFAULT NULL,
  rtp_timeout             INT DEFAULT NULL,
  webrtc                  ENUM('yes','no') DEFAULT NULL,
  bundle                  ENUM('yes','no') DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- ps_endpoint_id_ips: identify an endpoint by source IP (gateways) ----
CREATE TABLE ps_endpoint_id_ips (
  id       VARCHAR(40) NOT NULL PRIMARY KEY,
  endpoint VARCHAR(40) DEFAULT NULL,
  `match`  VARCHAR(80) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

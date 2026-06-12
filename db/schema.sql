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
DROP TABLE IF EXISTS ps_endpoint_id_ips;
DROP TABLE IF EXISTS ps_endpoints;
DROP TABLE IF EXISTS ps_auths;
DROP TABLE IF EXISTS ps_aors;
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
  reports_to    INT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_team (team_id),
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

-- ---- campaigns: a calling campaign (auto-dialer source) ----
CREATE TABLE campaigns (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  name                VARCHAR(150) NOT NULL,
  description         TEXT NULL,
  script              TEXT NULL,
  created_by          INT NULL,
  group_id            INT NULL,
  status              ENUM('active','paused','completed') NOT NULL DEFAULT 'active',
  dialer_type         ENUM('predictive','manual','inbound','ratio') NOT NULL DEFAULT 'manual',
  calling_start       TIME NULL,
  calling_end         TIME NULL,
  retry_count         INT NOT NULL DEFAULT 0,
  retry_delay_minutes INT NOT NULL DEFAULT 60,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_campaigns_creator FOREIGN KEY (created_by) REFERENCES users(id)    ON DELETE SET NULL,
  CONSTRAINT fk_campaigns_group   FOREIGN KEY (group_id)   REFERENCES `groups`(id) ON DELETE SET NULL,
  INDEX idx_campaigns_status (status),
  INDEX idx_campaigns_group (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- csv_data: uploaded contacts belonging to a campaign ----
CREATE TABLE csv_data (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id   INT NOT NULL,
  phone_number  VARCHAR(32) NOT NULL,
  name          VARCHAR(150) NULL,
  email         VARCHAR(180) NULL,
  company       VARCHAR(150) NULL,
  custom_fields JSON NULL,
  called        TINYINT(1) NOT NULL DEFAULT 0,
  call_status   VARCHAR(32) NULL,
  assigned_to   INT NULL,
  claimed_at    DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_csv_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_csv_assigned FOREIGN KEY (assigned_to) REFERENCES users(id)     ON DELETE SET NULL,
  -- Hot path: the auto-dialer claims "the next un-called contact for a campaign".
  INDEX idx_csv_campaign_called (campaign_id, called),
  INDEX idx_csv_assigned (assigned_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- calls: one row per call attempt ----
CREATE TABLE calls (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  employee_id      INT NOT NULL,
  campaign_id      INT NULL,
  csv_data_id      INT NULL,
  phone_number     VARCHAR(32) NOT NULL,
  contact_name     VARCHAR(150) NULL,
  direction        ENUM('inbound','outbound') NOT NULL DEFAULT 'outbound',
  status           ENUM('connected','no_answer','busy','failed','voicemail','wrong_number','completed')
                     NOT NULL DEFAULT 'completed',
  duration_seconds INT NOT NULL DEFAULT 0,
  started_at       DATETIME NULL,
  ended_at         DATETIME NULL,
  recording_url    VARCHAR(255) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_calls_employee FOREIGN KEY (employee_id) REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_calls_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  CONSTRAINT fk_calls_csv      FOREIGN KEY (csv_data_id) REFERENCES csv_data(id)  ON DELETE SET NULL,
  INDEX idx_calls_employee_created (employee_id, created_at),
  INDEX idx_calls_campaign_created (campaign_id, created_at),
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

-- ---- scheduled_calls: follow-up calls ----
CREATE TABLE scheduled_calls (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  call_note_id INT NULL,
  phone_number VARCHAR(32) NOT NULL,
  contact_name VARCHAR(150) NULL,
  scheduled_at DATETIME NOT NULL,
  assigned_to  INT NOT NULL,
  status       ENUM('pending','done','missed','cancelled') NOT NULL DEFAULT 'pending',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sched_note     FOREIGN KEY (call_note_id) REFERENCES call_notes(id) ON DELETE SET NULL,
  CONSTRAINT fk_sched_assigned FOREIGN KEY (assigned_to)  REFERENCES users(id)      ON DELETE CASCADE,
  INDEX idx_sched_assigned_status (assigned_to, status)
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
CREATE TABLE gsm_gateways (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  ip                VARCHAR(64)  NOT NULL,
  port              SMALLINT UNSIGNED NOT NULL DEFAULT 5060,
  channels          SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Number of SIM/GSM channels',
  status            ENUM('active','inactive') NOT NULL DEFAULT 'active',
  asterisk_endpoint VARCHAR(100) NULL COMMENT 'PJSIP endpoint name in Asterisk, e.g. gw1',
  notes             VARCHAR(255) NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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

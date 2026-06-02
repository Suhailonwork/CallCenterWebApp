-- -- =====================================================================
-- --  Call Center Platform - COMPLETE MySQL setup
-- --
-- --  Run this once as the MySQL root user:
-- --      mysql -u root -p < db/full-setup.sql
-- --
-- --  It creates the database, the application user, and all 12 tables.
-- --  After this, load demo data with:   npm run db:seed
-- --
-- --  WARNING: the DROP TABLE statements wipe existing call-center tables.
-- -- =====================================================================

-- -- ---- database ----
-- CREATE DATABASE IF NOT EXISTS callcenter
--   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -- ---- application user (matches backend/.env) ----
-- CREATE USER IF NOT EXISTS 'ccuser'@'%'         IDENTIFIED BY 'ccpassword';
-- CREATE USER IF NOT EXISTS 'ccuser'@'localhost' IDENTIFIED BY 'ccpassword';
-- GRANT ALL PRIVILEGES ON callcenter.* TO 'ccuser'@'%';
-- GRANT ALL PRIVILEGES ON callcenter.* TO 'ccuser'@'localhost';
-- FLUSH PRIVILEGES;

-- USE callcenter;

-- SET FOREIGN_KEY_CHECKS = 0;
-- DROP TABLE IF EXISTS agent_sessions;
-- DROP TABLE IF EXISTS campaign_assignments;
-- DROP TABLE IF EXISTS settings;
-- DROP TABLE IF EXISTS audit_logs;
-- DROP TABLE IF EXISTS performance;
-- DROP TABLE IF EXISTS breaks;
-- DROP TABLE IF EXISTS scheduled_calls;
-- DROP TABLE IF EXISTS call_notes;
-- DROP TABLE IF EXISTS calls;
-- DROP TABLE IF EXISTS csv_data;
-- DROP TABLE IF EXISTS campaigns;
-- DROP TABLE IF EXISTS employees;
-- DROP TABLE IF EXISTS teams;
-- DROP TABLE IF EXISTS users;
-- SET FOREIGN_KEY_CHECKS = 1;

-- -- 1. users - every account (admin / manager / tl / employee)
-- CREATE TABLE users (
--   id            INT AUTO_INCREMENT PRIMARY KEY,
--   name          VARCHAR(120) NOT NULL,
--   email         VARCHAR(180) NOT NULL UNIQUE,
--   password_hash VARCHAR(255) NOT NULL,
--   role          ENUM('admin','manager','tl','employee') NOT NULL,
--   team_id       INT NULL,
--   reports_to    INT NULL,
--   is_active     TINYINT(1) NOT NULL DEFAULT 1,
--   created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--   INDEX idx_users_role (role),
--   INDEX idx_users_team (team_id),
--   INDEX idx_users_reports_to (reports_to)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- 2. teams - a TL + their employees, owned by a manager
-- CREATE TABLE teams (
--   id         INT AUTO_INCREMENT PRIMARY KEY,
--   name       VARCHAR(120) NOT NULL,
--   manager_id INT NULL,
--   tl_id      INT NULL,
--   created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT fk_teams_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
--   CONSTRAINT fk_teams_tl      FOREIGN KEY (tl_id)      REFERENCES users(id) ON DELETE SET NULL
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ALTER TABLE users
--   ADD CONSTRAINT fk_users_team       FOREIGN KEY (team_id)    REFERENCES teams(id) ON DELETE SET NULL,
--   ADD CONSTRAINT fk_users_reports_to FOREIGN KEY (reports_to) REFERENCES users(id) ON DELETE SET NULL;

-- -- 3. employees - extra profile fields for employee-role users
-- CREATE TABLE employees (
--   id            INT AUTO_INCREMENT PRIMARY KEY,
--   user_id       INT NOT NULL UNIQUE,
--   sip_extension VARCHAR(32) NOT NULL,
--   sip_password  VARCHAR(64) NOT NULL,
--   status        ENUM('offline','available','on_call','break') NOT NULL DEFAULT 'offline',
--   break_status  VARCHAR(32) NULL,
--   created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--   CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- 4. campaigns - a calling campaign (auto-dialer source)
-- CREATE TABLE campaigns (
--   id                  INT AUTO_INCREMENT PRIMARY KEY,
--   name                VARCHAR(150) NOT NULL,
--   description         TEXT NULL,
--   script              TEXT NULL,
--   created_by          INT NULL,
--   status              ENUM('active','paused','completed') NOT NULL DEFAULT 'active',
--   calling_start       TIME NULL,
--   calling_end         TIME NULL,
--   retry_count         INT NOT NULL DEFAULT 0,
--   retry_delay_minutes INT NOT NULL DEFAULT 60,
--   created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT fk_campaigns_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- 5. csv_data - uploaded contacts belonging to a campaign
-- CREATE TABLE csv_data (
--   id            INT AUTO_INCREMENT PRIMARY KEY,
--   campaign_id   INT NOT NULL,
--   phone_number  VARCHAR(32) NOT NULL,
--   name          VARCHAR(150) NULL,
--   email         VARCHAR(180) NULL,
--   company       VARCHAR(150) NULL,
--   custom_fields JSON NULL,
--   called        TINYINT(1) NOT NULL DEFAULT 0,
--   call_status   VARCHAR(32) NULL,
--   assigned_to   INT NULL,
--   created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT fk_csv_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
--   CONSTRAINT fk_csv_assigned FOREIGN KEY (assigned_to) REFERENCES users(id)     ON DELETE SET NULL,
--   INDEX idx_csv_campaign_called (campaign_id, called)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- 6. calls - one row per call attempt
-- CREATE TABLE calls (
--   id               INT AUTO_INCREMENT PRIMARY KEY,
--   employee_id      INT NOT NULL,
--   campaign_id      INT NULL,
--   csv_data_id      INT NULL,
--   phone_number     VARCHAR(32) NOT NULL,
--   contact_name     VARCHAR(150) NULL,
--   direction        ENUM('inbound','outbound') NOT NULL DEFAULT 'outbound',
--   status           ENUM('connected','no_answer','busy','failed','voicemail','wrong_number','completed')
--                      NOT NULL DEFAULT 'completed',
--   duration_seconds INT NOT NULL DEFAULT 0,
--   started_at       DATETIME NULL,
--   ended_at         DATETIME NULL,
--   recording_url    VARCHAR(255) NULL,
--   created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT fk_calls_employee FOREIGN KEY (employee_id) REFERENCES users(id)     ON DELETE CASCADE,
--   CONSTRAINT fk_calls_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
--   CONSTRAINT fk_calls_csv      FOREIGN KEY (csv_data_id) REFERENCES csv_data(id)  ON DELETE SET NULL,
--   INDEX idx_calls_employee_created (employee_id, created_at),
--   INDEX idx_calls_status (status)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- 7. call_notes - post-call notes / disposition tags
-- CREATE TABLE call_notes (
--   id           INT AUTO_INCREMENT PRIMARY KEY,
--   call_id      INT NOT NULL,
--   employee_id  INT NOT NULL,
--   note         TEXT NULL,
--   tags         VARCHAR(255) NULL,
--   follow_up_at DATETIME NULL,
--   created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT fk_notes_call     FOREIGN KEY (call_id)     REFERENCES calls(id) ON DELETE CASCADE,
--   CONSTRAINT fk_notes_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- 8. scheduled_calls - follow-up calls
-- CREATE TABLE scheduled_calls (
--   id           INT AUTO_INCREMENT PRIMARY KEY,
--   call_note_id INT NULL,
--   phone_number VARCHAR(32) NOT NULL,
--   contact_name VARCHAR(150) NULL,
--   scheduled_at DATETIME NOT NULL,
--   assigned_to  INT NOT NULL,
--   status       ENUM('pending','done','missed','cancelled') NOT NULL DEFAULT 'pending',
--   created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT fk_sched_note     FOREIGN KEY (call_note_id) REFERENCES call_notes(id) ON DELETE SET NULL,
--   CONSTRAINT fk_sched_assigned FOREIGN KEY (assigned_to)  REFERENCES users(id)      ON DELETE CASCADE,
--   INDEX idx_sched_assigned_status (assigned_to, status)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- 9. breaks - break / lunch requests
-- CREATE TABLE breaks (
--   id          INT AUTO_INCREMENT PRIMARY KEY,
--   employee_id INT NOT NULL,
--   break_type  ENUM('lunch','short','other') NOT NULL DEFAULT 'short',
--   reason      VARCHAR(255) NULL,
--   status      ENUM('requested','approved','denied','active','completed') NOT NULL DEFAULT 'requested',
--   start_time  DATETIME NULL,
--   end_time    DATETIME NULL,
--   approved_by INT NULL,
--   created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT fk_breaks_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
--   CONSTRAINT fk_breaks_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- 10. performance - daily rollup per employee
-- CREATE TABLE performance (
--   id                     INT AUTO_INCREMENT PRIMARY KEY,
--   employee_id            INT NOT NULL,
--   date                   DATE NOT NULL,
--   calls_made             INT NOT NULL DEFAULT 0,
--   calls_connected        INT NOT NULL DEFAULT 0,
--   success_rate           DECIMAL(5,2) NOT NULL DEFAULT 0,
--   total_duration_seconds INT NOT NULL DEFAULT 0,
--   break_duration_seconds INT NOT NULL DEFAULT 0,
--   created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   UNIQUE KEY uq_perf_emp_date (employee_id, date),
--   CONSTRAINT fk_perf_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- 11. audit_logs - security-relevant actions
-- CREATE TABLE audit_logs (
--   id         INT AUTO_INCREMENT PRIMARY KEY,
--   user_id    INT NULL,
--   action     VARCHAR(100) NOT NULL,
--   entity     VARCHAR(60) NULL,
--   entity_id  INT NULL,
--   details    JSON NULL,
--   ip         VARCHAR(64) NULL,
--   created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
--   INDEX idx_audit_created (created_at)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- 12. settings - system configuration (key/value)
-- CREATE TABLE settings (
--   id            INT AUTO_INCREMENT PRIMARY KEY,
--   setting_key   VARCHAR(80) NOT NULL UNIQUE,
--   setting_value VARCHAR(255) NOT NULL,
--   updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- 13. campaign_assignments - which agents work which campaign
-- CREATE TABLE campaign_assignments (
--   id          INT AUTO_INCREMENT PRIMARY KEY,
--   campaign_id INT NOT NULL,
--   employee_id INT NOT NULL,
--   assigned_by INT NULL,
--   created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   UNIQUE KEY uq_assignment (campaign_id, employee_id),
--   CONSTRAINT fk_ca_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
--   CONSTRAINT fk_ca_employee FOREIGN KEY (employee_id) REFERENCES users(id)     ON DELETE CASCADE,
--   CONSTRAINT fk_ca_assigner FOREIGN KEY (assigned_by) REFERENCES users(id)     ON DELETE SET NULL
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- 14. agent_sessions - agent login / logout times
-- CREATE TABLE agent_sessions (
--   id          INT AUTO_INCREMENT PRIMARY KEY,
--   employee_id INT NOT NULL,
--   login_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   logout_at   DATETIME NULL,
--   CONSTRAINT fk_as_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
--   INDEX idx_as_employee (employee_id),
--   INDEX idx_as_login (login_at)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- ---- default system settings ----
-- INSERT INTO settings (setting_key, setting_value) VALUES
--   ('break_minutes_per_day', '60'),
--   ('max_breaks_per_day',    '4'),
--   ('call_limit_per_day',    '120'),
--   ('work_start',            '09:00'),
--   ('work_end',              '18:00'),
--   ('min_password_length',   '8'),
--   ('recording_retention_days', '90');



-- -- =====================================================================
-- --  Adds the auto-dialer tables to an EXISTING callcenter database
-- --  without wiping users, calls, campaigns, etc.
-- --
-- --  Run:  mysql -u root -p callcenter < db/add-autodialer-tables.sql
-- --
-- --  (Use this if you don't want to lose data. Otherwise just run
-- --   `npm run db:reset`, which rebuilds everything from scratch.)
-- -- =====================================================================

-- USE callcenter;

-- DROP TABLE IF EXISTS agent_sessions;
-- DROP TABLE IF EXISTS campaign_assignments;

-- -- which agents work which campaign
-- CREATE TABLE campaign_assignments (
--   id          INT AUTO_INCREMENT PRIMARY KEY,
--   campaign_id INT NOT NULL,
--   employee_id INT NOT NULL,
--   assigned_by INT NULL,
--   created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   UNIQUE KEY uq_assignment (campaign_id, employee_id),
--   CONSTRAINT fk_ca_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
--   CONSTRAINT fk_ca_employee FOREIGN KEY (employee_id) REFERENCES users(id)     ON DELETE CASCADE,
--   CONSTRAINT fk_ca_assigner FOREIGN KEY (assigned_by) REFERENCES users(id)     ON DELETE SET NULL
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- agent login / logout times (for login-hours tracking)
-- CREATE TABLE agent_sessions (
--   id          INT AUTO_INCREMENT PRIMARY KEY,
--   employee_id INT NOT NULL,
--   login_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   logout_at   DATETIME NULL,
--   CONSTRAINT fk_as_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
--   INDEX idx_as_employee (employee_id),
--   INDEX idx_as_login (login_at)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- -- Atomic claim support for csv_data so two agents never dial the same contact.
-- -- Run once:  mysql -u root -p callcenter < db/add-csv-claim.sql
-- USE callcenter;

-- ALTER TABLE csv_data
--   ADD COLUMN claimed_at DATETIME NULL AFTER assigned_to;

-- CREATE INDEX idx_csv_claim ON csv_data (campaign_id, called, claimed_at);



-- -- Migration: add dialer_type column to campaigns
-- -- Run once against your existing database.

-- ALTER TABLE campaigns
--   ADD COLUMN dialer_type ENUM('predictive','manual','inbound','ratio')
--     NOT NULL DEFAULT 'manual'
--     AFTER status;






-- -- Migration: add asterisk_endpoint column to gsm_gateways
-- -- This maps each gateway to its PJSIP endpoint name in Asterisk (e.g. "dinstar").
-- -- Run once against your existing database.

-- ALTER TABLE gsm_gateways
--   ADD COLUMN asterisk_endpoint VARCHAR(100) NULL
--     COMMENT 'PJSIP endpoint name in Asterisk, e.g. dinstar'
--     AFTER status;

-- -- If you only have one gateway and it uses the "dinstar" endpoint, run this too:
-- -- UPDATE gsm_gateways SET asterisk_endpoint = 'dinstar';



-- -- ─────────────────────────────────────────────────────────────────
-- -- Migration: add GSM gateways + campaign_gateways tables
-- -- Run once on an existing database:
-- --   mysql -u root -p callcenter < db/add-gsm-gateways.sql
-- -- ─────────────────────────────────────────────────────────────────

-- CREATE TABLE IF NOT EXISTS gsm_gateways (
--   id         INT AUTO_INCREMENT PRIMARY KEY,
--   name       VARCHAR(100) NOT NULL,
--   ip         VARCHAR(64)  NOT NULL,
--   port       SMALLINT UNSIGNED NOT NULL DEFAULT 5060,
--   channels   SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Number of SIM/GSM channels',
--   status     ENUM('active','inactive') NOT NULL DEFAULT 'active',
--   notes      VARCHAR(255) NULL,
--   created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CREATE TABLE IF NOT EXISTS campaign_gateways (
--   id          INT AUTO_INCREMENT PRIMARY KEY,
--   campaign_id INT NOT NULL,
--   gateway_id  INT NOT NULL,
--   created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   UNIQUE KEY uq_cg (campaign_id, gateway_id),
--   CONSTRAINT fk_cg_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
--   CONSTRAINT fk_cg_gateway  FOREIGN KEY (gateway_id)  REFERENCES gsm_gateways(id) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;




-- -- ─────────────────────────────────────────────────────────────────────────────
-- --  Asterisk PJSIP Realtime Tables
-- --  These let Asterisk read ALL SIP endpoint/auth/aor config from MySQL.
-- --  After running this you NEVER edit pjsip.conf for employees or gateways again.
-- --
-- --  Run once:
-- --    mysql -u root -p callcenter < db/asterisk-realtime-tables.sql
-- -- ─────────────────────────────────────────────────────────────────────────────

-- -- Endpoints (one row per SIP peer)
-- CREATE TABLE IF NOT EXISTS ps_endpoints (
--   id                          VARCHAR(40)  NOT NULL,
--   transport                   VARCHAR(40)  NULL,
--   aors                        VARCHAR(200) NULL,
--   auth                        VARCHAR(200) NULL,
--   context                     VARCHAR(40)  NULL,
--   disallow                    VARCHAR(200) NULL,
--   allow                       VARCHAR(200) NULL,
--   direct_media                VARCHAR(3)   NULL DEFAULT 'yes',
--   connected_line_method        VARCHAR(40)  NULL,
--   direct_media_method          VARCHAR(40)  NULL,
--   direct_media_glare_mitigation VARCHAR(40) NULL,
--   disable_direct_media_on_nat  VARCHAR(3)  NULL,
--   dtmf_mode                   VARCHAR(40)  NULL,
--   external_media_address       VARCHAR(40)  NULL,
--   force_rport                  VARCHAR(3)  NULL,
--   ice_support                  VARCHAR(3)  NULL,
--   identify_by                  VARCHAR(40)  NULL,
--   mailboxes                    VARCHAR(40)  NULL,
--   moh_suggest                  VARCHAR(40)  NULL,
--   outbound_auth                VARCHAR(40)  NULL,
--   outbound_proxy               VARCHAR(40)  NULL,
--   rewrite_contact              VARCHAR(3)  NULL,
--   rtp_ipv6                     VARCHAR(3)  NULL,
--   rtp_symmetric                VARCHAR(3)  NULL,
--   send_pai                     VARCHAR(3)  NULL,
--   use_avpf                     VARCHAR(3)  NULL,
--   media_encryption              VARCHAR(40) NULL,
--   inband_progress               VARCHAR(3)  NULL,
--   call_group                    VARCHAR(40) NULL,
--   pickup_group                  VARCHAR(40) NULL,
--   named_call_group              VARCHAR(40) NULL,
--   named_pickup_group            VARCHAR(40) NULL,
--   device_state_busy_at          INT        NULL,
--   t38_udptl                     VARCHAR(3)  NULL,
--   t38_udptl_ec                  VARCHAR(40) NULL,
--   t38_udptl_maxdatagram         INT        NULL,
--   t38_udptl_nat                 VARCHAR(3)  NULL,
--   t38_udptl_ipv6                VARCHAR(3)  NULL,
--   tone_zone                     VARCHAR(40) NULL,
--   language                      VARCHAR(40) NULL,
--   one_touch_recording            VARCHAR(3)  NULL,
--   record_on_feature              VARCHAR(40) NULL,
--   record_off_feature             VARCHAR(40) NULL,
--   rtp_engine                    VARCHAR(40) NULL,
--   allow_transfer                 VARCHAR(3)  NULL,
--   sdp_owner                     VARCHAR(40) NULL,
--   sdp_session                   VARCHAR(40) NULL,
--   tos_audio                     VARCHAR(10) NULL,
--   tos_video                     VARCHAR(10) NULL,
--   cos_audio                     INT        NULL,
--   cos_video                     INT        NULL,
--   sub_min_expiry                 INT        NULL,
--   from_domain                   VARCHAR(40) NULL,
--   from_user                     VARCHAR(40) NULL,
--   mwi_from_user                 VARCHAR(40) NULL,
--   dtls_verify                   VARCHAR(40) NULL,
--   dtls_rekey                    VARCHAR(40) NULL,
--   dtls_cert_file                VARCHAR(200) NULL,
--   dtls_private_key              VARCHAR(200) NULL,
--   dtls_cipher                   VARCHAR(200) NULL,
--   dtls_ca_file                  VARCHAR(200) NULL,
--   dtls_ca_path                  VARCHAR(200) NULL,
--   dtls_setup                    VARCHAR(40) NULL,
--   dtls_fingerprint              VARCHAR(40) NULL,
--   srtp_tag_32                   VARCHAR(3)  NULL,
--   media_address                 VARCHAR(40) NULL,
--   redirect_method               VARCHAR(40) NULL,
--   set_var                       VARCHAR(200) NULL,
--   `100rel`                      VARCHAR(40) NULL,
--   preferred_codec_only          VARCHAR(3)  NULL,
--   asymmetric_rtp_codec          VARCHAR(3)  NULL,
--   rtcp_mux                      VARCHAR(3)  NULL,
--   allow_overlap                 VARCHAR(3)  NULL,
--   refer_blind_progress          VARCHAR(3)  NULL,
--   notify_early_inuse_ringing    VARCHAR(3)  NULL,
--   max_audio_streams             INT        NULL,
--   max_video_streams             INT        NULL,
--   bundle                        VARCHAR(3)  NULL,
--   webrtc                        VARCHAR(3)  NULL,
--   incoming_mwi_mailbox          VARCHAR(40) NULL,
--   follow_early_media_fork       VARCHAR(3)  NULL,
--   accept_multiple_sdp_answers   VARCHAR(3)  NULL,
--   suppress_q850_reason_headers  VARCHAR(3)  NULL,
--   trust_connected_line          VARCHAR(3)  NULL,
--   send_connected_line           VARCHAR(3)  NULL,
--   ignore_183_without_sdp        VARCHAR(3)  NULL,
--   codec_prefs_incoming_offer    VARCHAR(128) NULL,
--   codec_prefs_outgoing_offer    VARCHAR(128) NULL,
--   codec_prefs_incoming_answer   VARCHAR(128) NULL,
--   codec_prefs_outgoing_answer   VARCHAR(128) NULL,
--   stir_shaken                   VARCHAR(3)  NULL,
--   dtls_auto_generate_cert       VARCHAR(3)  NULL,
--   UNIQUE KEY id (id)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- Authentication objects
-- CREATE TABLE IF NOT EXISTS ps_auths (
--   id              VARCHAR(40)  NOT NULL,
--   auth_type       VARCHAR(40)  NULL,
--   nonce_lifetime  INT          NULL,
--   md5_cred        VARCHAR(40)  NULL,
--   password        VARCHAR(80)  NULL,
--   realm           VARCHAR(40)  NULL,
--   username        VARCHAR(40)  NULL,
--   UNIQUE KEY id (id)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- Address of Record objects
-- CREATE TABLE IF NOT EXISTS ps_aors (
--   id                          VARCHAR(40)  NOT NULL,
--   contact                     VARCHAR(255) NULL,
--   default_expiry              INT          NULL,
--   mailboxes                   VARCHAR(80)  NULL,
--   max_contacts                INT          NULL,
--   minimum_expiry              INT          NULL,
--   remove_existing             VARCHAR(3)   NULL,
--   qualify_frequency           INT          NULL,
--   authenticate_qualify        VARCHAR(3)   NULL,
--   maximum_expiry              INT          NULL,
--   outbound_proxy              VARCHAR(40)  NULL,
--   support_path                VARCHAR(3)   NULL,
--   qualify_timeout             FLOAT        NULL,
--   voicemail_extension         VARCHAR(40)  NULL,
--   UNIQUE KEY id (id)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- Endpoint identification (match by IP for gateways)
-- CREATE TABLE IF NOT EXISTS ps_endpoint_id_ips (
--   id       VARCHAR(40)  NOT NULL,
--   endpoint VARCHAR(40)  NOT NULL,
--   `match`  VARCHAR(80)  NOT NULL,
--   UNIQUE KEY id (id)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- ─────────────────────────────────────────────────────────────────
-- --  Backfill realtime PJSIP tables from existing app data.
-- --
-- --  Run ONCE, after creating the realtime tables, to load agents and
-- --  gateways that already existed before realtime was switched on:
-- --
-- --    mysql -u root -p callcenter < db/asterisk-realtime-tables.sql   # tables
-- --    mysql -u root -p callcenter < db/backfill-realtime-endpoints.sql # this file
-- --
-- --  After this, the admin panel keeps the ps_* tables in sync
-- --  automatically (provisionEmployeeEndpoint / provisionGatewayEndpoint).
-- --  Column values below MUST match src/lib/asteriskRealtime.ts.
-- -- ─────────────────────────────────────────────────────────────────

-- USE callcenter;

-- -- ── Employees → WebRTC endpoints ─────────────────────────────────
-- INSERT INTO ps_endpoints
--   (id, transport, aors, auth, context, disallow, allow, webrtc, dtls_auto_generate_cert, direct_media)
-- SELECT e.sip_extension, 'transport-wss', e.sip_extension, CONCAT(e.sip_extension, '-auth'),
--        'from-webrtc', 'all', 'ulaw,alaw', 'yes', 'yes', 'no'
-- FROM employees e JOIN users u ON u.id = e.user_id
-- WHERE u.is_active = 1
-- ON DUPLICATE KEY UPDATE
--   transport=VALUES(transport), aors=VALUES(aors), auth=VALUES(auth), context=VALUES(context),
--   disallow=VALUES(disallow), allow=VALUES(allow), webrtc=VALUES(webrtc),
--   dtls_auto_generate_cert=VALUES(dtls_auto_generate_cert), direct_media=VALUES(direct_media);

-- INSERT INTO ps_auths (id, auth_type, username, password)
-- SELECT CONCAT(e.sip_extension, '-auth'), 'userpass', e.sip_extension, e.sip_password
-- FROM employees e JOIN users u ON u.id = e.user_id
-- WHERE u.is_active = 1
-- ON DUPLICATE KEY UPDATE username=VALUES(username), password=VALUES(password);

-- INSERT INTO ps_aors (id, max_contacts, remove_existing)
-- SELECT e.sip_extension, 1, 'yes'
-- FROM employees e JOIN users u ON u.id = e.user_id
-- WHERE u.is_active = 1
-- ON DUPLICATE KEY UPDATE max_contacts=VALUES(max_contacts), remove_existing=VALUES(remove_existing);

-- -- ── GSM gateways → trunk endpoints (named gw{id}) ────────────────
-- UPDATE gsm_gateways SET asterisk_endpoint = CONCAT('gw', id);

-- INSERT INTO ps_endpoints
--   (id, transport, aors, context, disallow, allow, direct_media, rtp_symmetric, rewrite_contact)
-- SELECT CONCAT('gw', id), 'transport-udp', CONCAT('gw', id), 'from-dinstar',
--        'all', 'ulaw,alaw', 'no', 'yes', 'yes'
-- FROM gsm_gateways WHERE status = 'active'
-- ON DUPLICATE KEY UPDATE
--   transport=VALUES(transport), aors=VALUES(aors), context=VALUES(context),
--   disallow=VALUES(disallow), allow=VALUES(allow), direct_media=VALUES(direct_media),
--   rtp_symmetric=VALUES(rtp_symmetric), rewrite_contact=VALUES(rewrite_contact);

-- INSERT INTO ps_aors (id, contact, qualify_frequency)
-- SELECT CONCAT('gw', id), CONCAT('sip:', ip, ':', port), 30
-- FROM gsm_gateways WHERE status = 'active'
-- ON DUPLICATE KEY UPDATE contact=VALUES(contact), qualify_frequency=VALUES(qualify_frequency);

-- INSERT INTO ps_endpoint_id_ips (id, endpoint, `match`)
-- SELECT CONCAT('gw', id, '-identify'), CONCAT('gw', id), ip
-- FROM gsm_gateways WHERE status = 'active'
-- ON DUPLICATE KEY UPDATE endpoint=VALUES(endpoint), `match`=VALUES(`match`);

-- -- Sanity check
-- SELECT id, transport, context FROM ps_endpoints ORDER BY id;



-- -- Migration: Set asterisk_endpoint = 'gw{id}' for all existing gateways
-- -- and clean up stale ps_* entries, then reprovision correctly.
-- -- Run once on your callcenter database.

-- USE callcenter;

-- -- Step 1: Set asterisk_endpoint to gw{id} for all gateways
-- UPDATE gsm_gateways SET asterisk_endpoint = CONCAT('gw', id);

-- -- Step 2: Clean up all gateway entries in realtime tables (keep only employee entries)
-- SET SQL_SAFE_UPDATES = 0;
-- DELETE FROM ps_endpoints        WHERE id NOT REGEXP '^[0-9]+$';
-- DELETE FROM ps_auths            WHERE id NOT REGEXP '^[0-9]';
-- DELETE FROM ps_aors             WHERE id NOT REGEXP '^[0-9]+$';
-- DELETE FROM ps_endpoint_id_ips  WHERE id IS NOT NULL;
-- SET SQL_SAFE_UPDATES = 1;

-- -- Step 3: Re-insert gateways with correct gw{id} names
-- INSERT INTO ps_endpoints (id, transport, aors, context, disallow, allow, direct_media, rtp_symmetric, rewrite_contact)
-- SELECT CONCAT('gw', id), 'transport-udp', CONCAT('gw', id), 'from-dinstar', 'all', 'ulaw,alaw', 'no', 'yes', 'yes'
-- FROM gsm_gateways WHERE status = 'active';

-- INSERT INTO ps_aors (id, contact, qualify_frequency)
-- SELECT CONCAT('gw', id), CONCAT('sip:', ip, ':', port), 30
-- FROM gsm_gateways WHERE status = 'active';

-- INSERT INTO ps_endpoint_id_ips (id, endpoint, `match`)
-- SELECT CONCAT('gw', id, '-identify'), CONCAT('gw', id), ip
-- FROM gsm_gateways WHERE status = 'active';



-- -- Give every existing agent a unique random SIP password (16 hex chars) and
-- -- sync Asterisk's realtime auth table so they keep authenticating.
-- -- Run once:  mysql -u root -p callcenter < db/randomize-agent-passwords.sql
-- -- Agents re-register automatically (their browser re-fetches /api/employee/sip).
-- USE callcenter;

-- UPDATE employees SET sip_password = SUBSTRING(MD5(RAND()), 1, 16);

-- -- Sync realtime auth rows (no-op if you use static pjsip.conf instead).
-- UPDATE ps_auths a
--   JOIN employees e ON a.id = CONCAT(e.sip_extension, '-auth')
--    SET a.password = e.sip_password;

-- SELECT sip_extension, sip_password FROM employees ORDER BY sip_extension;



-- -- =====================================================================
-- --  Call Center Platform - MySQL schema
-- --  Run by db/migrate.mjs. WARNING: drops and recreates all tables.
-- -- =====================================================================

-- SET FOREIGN_KEY_CHECKS = 0;
-- DROP TABLE IF EXISTS agent_sessions;
-- DROP TABLE IF EXISTS campaign_gateways;
-- DROP TABLE IF EXISTS gsm_gateways;
-- DROP TABLE IF EXISTS campaign_assignments;
-- DROP TABLE IF EXISTS settings;
-- DROP TABLE IF EXISTS audit_logs;
-- DROP TABLE IF EXISTS performance;
-- DROP TABLE IF EXISTS breaks;
-- DROP TABLE IF EXISTS scheduled_calls;
-- DROP TABLE IF EXISTS call_notes;
-- DROP TABLE IF EXISTS calls;
-- DROP TABLE IF EXISTS csv_data;
-- DROP TABLE IF EXISTS campaigns;
-- DROP TABLE IF EXISTS employees;
-- DROP TABLE IF EXISTS teams;
-- DROP TABLE IF EXISTS users;
-- SET FOREIGN_KEY_CHECKS = 1;

-- -- ---- users: every account (admin / manager / tl / employee) ----
-- CREATE TABLE users (
--   id            INT AUTO_INCREMENT PRIMARY KEY,
--   name          VARCHAR(120) NOT NULL,
--   email         VARCHAR(180) NOT NULL UNIQUE,
--   password_hash VARCHAR(255) NOT NULL,
--   role          ENUM('admin','manager','tl','employee') NOT NULL,
--   team_id       INT NULL,
--   reports_to    INT NULL,
--   is_active     TINYINT(1) NOT NULL DEFAULT 1,
--   created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--   INDEX idx_users_role (role),
--   INDEX idx_users_team (team_id),
--   INDEX idx_users_reports_to (reports_to)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- ---- teams: a TL + their employees, owned by a manager ----
-- CREATE TABLE teams (
--   id         INT AUTO_INCREMENT PRIMARY KEY,
--   name       VARCHAR(120) NOT NULL,
--   manager_id INT NULL,
--   tl_id      INT NULL,
--   created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT fk_teams_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
--   CONSTRAINT fk_teams_tl      FOREIGN KEY (tl_id)      REFERENCES users(id) ON DELETE SET NULL
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ALTER TABLE users
--   ADD CONSTRAINT fk_users_team       FOREIGN KEY (team_id)    REFERENCES teams(id) ON DELETE SET NULL,
--   ADD CONSTRAINT fk_users_reports_to FOREIGN KEY (reports_to) REFERENCES users(id) ON DELETE SET NULL;

-- -- ---- employees: extra profile fields for employee-role users ----
-- CREATE TABLE employees (
--   id            INT AUTO_INCREMENT PRIMARY KEY,
--   user_id       INT NOT NULL UNIQUE,
--   sip_extension VARCHAR(32) NOT NULL,
--   sip_password  VARCHAR(64) NOT NULL,
--   status        ENUM('offline','available','on_call','break') NOT NULL DEFAULT 'offline',
--   break_status  VARCHAR(32) NULL,
--   created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--   CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- ---- campaigns: a calling campaign (auto-dialer source) ----
-- CREATE TABLE campaigns (
--   id                  INT AUTO_INCREMENT PRIMARY KEY,
--   name                VARCHAR(150) NOT NULL,
--   description         TEXT NULL,
--   script              TEXT NULL,
--   created_by          INT NULL,
--   status              ENUM('active','paused','completed') NOT NULL DEFAULT 'active',
--   dialer_type         ENUM('predictive','manual','inbound','ratio') NOT NULL DEFAULT 'manual',
--   calling_start       TIME NULL,
--   calling_end         TIME NULL,
--   retry_count         INT NOT NULL DEFAULT 0,
--   retry_delay_minutes INT NOT NULL DEFAULT 60,
--   created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT fk_campaigns_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- ---- csv_data: uploaded contacts belonging to a campaign ----
-- CREATE TABLE csv_data (
--   id            INT AUTO_INCREMENT PRIMARY KEY,
--   campaign_id   INT NOT NULL,
--   phone_number  VARCHAR(32) NOT NULL,
--   name          VARCHAR(150) NULL,
--   email         VARCHAR(180) NULL,
--   company       VARCHAR(150) NULL,
--   custom_fields JSON NULL,
--   called        TINYINT(1) NOT NULL DEFAULT 0,
--   call_status   VARCHAR(32) NULL,
--   assigned_to   INT NULL,
--   claimed_at    DATETIME NULL,
--   created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT fk_csv_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
--   CONSTRAINT fk_csv_assigned FOREIGN KEY (assigned_to) REFERENCES users(id)     ON DELETE SET NULL,
--   INDEX idx_csv_campaign_called (campaign_id, called)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- ---- calls: one row per call attempt ----
-- CREATE TABLE calls (
--   id               INT AUTO_INCREMENT PRIMARY KEY,
--   employee_id      INT NOT NULL,
--   campaign_id      INT NULL,
--   csv_data_id      INT NULL,
--   phone_number     VARCHAR(32) NOT NULL,
--   contact_name     VARCHAR(150) NULL,
--   direction        ENUM('inbound','outbound') NOT NULL DEFAULT 'outbound',
--   status           ENUM('connected','no_answer','busy','failed','voicemail','wrong_number','completed')
--                      NOT NULL DEFAULT 'completed',
--   duration_seconds INT NOT NULL DEFAULT 0,
--   started_at       DATETIME NULL,
--   ended_at         DATETIME NULL,
--   recording_url    VARCHAR(255) NULL,
--   created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT fk_calls_employee FOREIGN KEY (employee_id) REFERENCES users(id)     ON DELETE CASCADE,
--   CONSTRAINT fk_calls_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
--   CONSTRAINT fk_calls_csv      FOREIGN KEY (csv_data_id) REFERENCES csv_data(id)  ON DELETE SET NULL,
--   INDEX idx_calls_employee_created (employee_id, created_at),
--   INDEX idx_calls_status (status)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- ---- call_notes: post-call notes / disposition tags ----
-- CREATE TABLE call_notes (
--   id           INT AUTO_INCREMENT PRIMARY KEY,
--   call_id      INT NOT NULL,
--   employee_id  INT NOT NULL,
--   note         TEXT NULL,
--   tags         VARCHAR(255) NULL,
--   follow_up_at DATETIME NULL,
--   created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT fk_notes_call     FOREIGN KEY (call_id)     REFERENCES calls(id) ON DELETE CASCADE,
--   CONSTRAINT fk_notes_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- ---- scheduled_calls: follow-up calls ----
-- CREATE TABLE scheduled_calls (
--   id           INT AUTO_INCREMENT PRIMARY KEY,
--   call_note_id INT NULL,
--   phone_number VARCHAR(32) NOT NULL,
--   contact_name VARCHAR(150) NULL,
--   scheduled_at DATETIME NOT NULL,
--   assigned_to  INT NOT NULL,
--   status       ENUM('pending','done','missed','cancelled') NOT NULL DEFAULT 'pending',
--   created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT fk_sched_note     FOREIGN KEY (call_note_id) REFERENCES call_notes(id) ON DELETE SET NULL,
--   CONSTRAINT fk_sched_assigned FOREIGN KEY (assigned_to)  REFERENCES users(id)      ON DELETE CASCADE,
--   INDEX idx_sched_assigned_status (assigned_to, status)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- ---- breaks: break / lunch requests ----
-- CREATE TABLE breaks (
--   id          INT AUTO_INCREMENT PRIMARY KEY,
--   employee_id INT NOT NULL,
--   break_type  ENUM('lunch','short','other') NOT NULL DEFAULT 'short',
--   reason      VARCHAR(255) NULL,
--   status      ENUM('requested','approved','denied','active','completed') NOT NULL DEFAULT 'requested',
--   start_time  DATETIME NULL,
--   end_time    DATETIME NULL,
--   approved_by INT NULL,
--   created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT fk_breaks_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
--   CONSTRAINT fk_breaks_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- ---- performance: daily rollup per employee ----
-- CREATE TABLE performance (
--   id                     INT AUTO_INCREMENT PRIMARY KEY,
--   employee_id            INT NOT NULL,
--   date                   DATE NOT NULL,
--   calls_made             INT NOT NULL DEFAULT 0,
--   calls_connected        INT NOT NULL DEFAULT 0,
--   success_rate           DECIMAL(5,2) NOT NULL DEFAULT 0,
--   total_duration_seconds INT NOT NULL DEFAULT 0,
--   break_duration_seconds INT NOT NULL DEFAULT 0,
--   created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   UNIQUE KEY uq_perf_emp_date (employee_id, date),
--   CONSTRAINT fk_perf_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- ---- audit_logs: security-relevant actions ----
-- CREATE TABLE audit_logs (
--   id         INT AUTO_INCREMENT PRIMARY KEY,
--   user_id    INT NULL,
--   action     VARCHAR(100) NOT NULL,
--   entity     VARCHAR(60) NULL,
--   entity_id  INT NULL,
--   details    JSON NULL,
--   ip         VARCHAR(64) NULL,
--   created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
--   INDEX idx_audit_created (created_at)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- ---- settings: system configuration (key/value) ----
-- CREATE TABLE settings (
--   id            INT AUTO_INCREMENT PRIMARY KEY,
--   setting_key   VARCHAR(80) NOT NULL UNIQUE,
--   setting_value VARCHAR(255) NOT NULL,
--   updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- ---- campaign_assignments: which agents work which campaign ----
-- CREATE TABLE campaign_assignments (
--   id          INT AUTO_INCREMENT PRIMARY KEY,
--   campaign_id INT NOT NULL,
--   employee_id INT NOT NULL,
--   assigned_by INT NULL,
--   created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   UNIQUE KEY uq_assignment (campaign_id, employee_id),
--   CONSTRAINT fk_ca_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
--   CONSTRAINT fk_ca_employee FOREIGN KEY (employee_id) REFERENCES users(id)     ON DELETE CASCADE,
--   CONSTRAINT fk_ca_assigner FOREIGN KEY (assigned_by) REFERENCES users(id)     ON DELETE SET NULL
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- ---- gsm_gateways: physical GSM/VoIP gateway devices ----
-- CREATE TABLE gsm_gateways (
--   id         INT AUTO_INCREMENT PRIMARY KEY,
--   name       VARCHAR(100) NOT NULL,
--   ip         VARCHAR(64)  NOT NULL,
--   port       SMALLINT UNSIGNED NOT NULL DEFAULT 5060,
--   channels   SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Number of SIM/GSM channels',
--   status              ENUM('active','inactive') NOT NULL DEFAULT 'active',
--   asterisk_endpoint   VARCHAR(100) NULL COMMENT 'PJSIP endpoint name in Asterisk, e.g. dinstar',
--   notes               VARCHAR(255) NULL,
--   created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- ---- campaign_gateways: which gateways are assigned to a campaign ----
-- CREATE TABLE campaign_gateways (
--   id          INT AUTO_INCREMENT PRIMARY KEY,
--   campaign_id INT NOT NULL,
--   gateway_id  INT NOT NULL,
--   created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   UNIQUE KEY uq_cg (campaign_id, gateway_id),
--   CONSTRAINT fk_cg_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
--   CONSTRAINT fk_cg_gateway  FOREIGN KEY (gateway_id)  REFERENCES gsm_gateways(id) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- ---- agent_sessions: agent login / logout times ----
-- CREATE TABLE agent_sessions (
--   id          INT AUTO_INCREMENT PRIMARY KEY,
--   employee_id INT NOT NULL,
--   login_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   logout_at   DATETIME NULL,
--   CONSTRAINT fk_as_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
--   INDEX idx_as_employee (employee_id),
--   INDEX idx_as_login (login_at)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;






-- =====================================================================
--  Call Center Platform  ·  Canonical MySQL Schema  ·  v2.0
--
--  Single source of truth — replaces all migration files.
--
--  Run as MySQL root:
--      mysql -u root -p < callcenter_schema.sql
--
--  Tables (17):
--    Core ............. users, teams, employees
--    Telephony ........ ps_endpoints, ps_auths, ps_aors, ps_endpoint_id_ips
--    Gateways ......... gsm_gateways, campaign_gateways
--    Campaigns ........ campaigns, campaign_assignments, csv_data
--    Call activity .... calls, call_notes, scheduled_calls, breaks, agent_sessions
--    Operations ....... performance, audit_logs, settings
--
--  Views (4):
--    v_agent_full_profile  — everything about a user in one row
--    v_active_agents       — currently logged-in / on-call agents
--    v_campaign_status     — campaign progress + gateways + agent count
--    v_upcoming_callbacks  — pending scheduled calls due in next 24 h
--
--  Procedures (4):
--    sp_get_user(p_id)                    — full profile for one user
--    sp_claim_contact(p_campaign, p_agent)— atomic dialer contact claim
--    sp_close_session(p_employee)         — logout + session close
--    sp_daily_rollup(p_date)              — refresh performance table
--
--  Triggers (3):
--    trg_call_insert_mark_csv    — marks csv_data.called after call created
--    trg_break_complete_status   — resets employee.status when break ends
--    trg_session_logout_status   — sets employee offline on session close
-- =====================================================================

-- ── Database ─────────────────────────────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS callcenter
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- ── Application user ──────────────────────────────────────────────────────────
CREATE USER IF NOT EXISTS 'ccuser'@'%'         IDENTIFIED BY 'ccpassword';
CREATE USER IF NOT EXISTS 'ccuser'@'localhost' IDENTIFIED BY 'ccpassword';
GRANT ALL PRIVILEGES ON callcenter.* TO 'ccuser'@'%';
GRANT ALL PRIVILEGES ON callcenter.* TO 'ccuser'@'localhost';
FLUSH PRIVILEGES;

USE callcenter;

-- ── Wipe (safe re-run) ────────────────────────────────────────────────────────
SET FOREIGN_KEY_CHECKS = 0;

DROP TRIGGER  IF EXISTS trg_call_insert_mark_csv;
DROP TRIGGER  IF EXISTS trg_break_complete_status;
DROP TRIGGER  IF EXISTS trg_session_logout_status;

DROP PROCEDURE IF EXISTS sp_get_user;
DROP PROCEDURE IF EXISTS sp_claim_contact;
DROP PROCEDURE IF EXISTS sp_close_session;
DROP PROCEDURE IF EXISTS sp_daily_rollup;

DROP VIEW IF EXISTS v_upcoming_callbacks;
DROP VIEW IF EXISTS v_campaign_status;
DROP VIEW IF EXISTS v_active_agents;
DROP VIEW IF EXISTS v_agent_full_profile;

DROP TABLE IF EXISTS agent_sessions;
DROP TABLE IF EXISTS campaign_gateways;
DROP TABLE IF EXISTS campaign_assignments;
DROP TABLE IF EXISTS performance;
DROP TABLE IF EXISTS breaks;
DROP TABLE IF EXISTS scheduled_calls;
DROP TABLE IF EXISTS call_notes;
DROP TABLE IF EXISTS calls;
DROP TABLE IF EXISTS csv_data;
DROP TABLE IF EXISTS campaigns;
DROP TABLE IF EXISTS ps_endpoint_id_ips;
DROP TABLE IF EXISTS ps_aors;
DROP TABLE IF EXISTS ps_auths;
DROP TABLE IF EXISTS ps_endpoints;
DROP TABLE IF EXISTS gsm_gateways;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;


-- ═════════════════════════════════════════════════════════════════════════════
--  SECTION 1 · CORE IDENTITY
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. users ──────────────────────────────────────────────────────────────────
--  Single auth table for every role. team_id / reports_to FKs added after teams.
CREATE TABLE users (
  id            INT            AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)   NOT NULL,
  email         VARCHAR(180)   NOT NULL,
  password_hash VARCHAR(255)   NOT NULL,
  role          ENUM('admin','manager','tl','employee') NOT NULL,
  team_id       INT            NULL COMMENT 'FK → teams.id (set after teams created)',
  reports_to    INT            NULL COMMENT 'FK → users.id (manager or TL above this user)',
  is_active     TINYINT(1)     NOT NULL DEFAULT 1,
  created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE  KEY uq_users_email       (email),
  INDEX         idx_users_role     (role),
  INDEX         idx_users_team     (team_id),
  INDEX         idx_users_reports  (reports_to),
  INDEX         idx_users_active   (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='All platform accounts';

-- ── 2. teams ──────────────────────────────────────────────────────────────────
CREATE TABLE teams (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  manager_id INT          NULL COMMENT 'FK → users.id (manager role)',
  tl_id      INT          NULL COMMENT 'FK → users.id (tl role)',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_teams_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_teams_tl      FOREIGN KEY (tl_id)      REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='A team leader + their agents, owned by a manager';

-- Back-patch users FKs now that teams exists
ALTER TABLE users
  ADD CONSTRAINT fk_users_team      FOREIGN KEY (team_id)   REFERENCES teams(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_users_reports   FOREIGN KEY (reports_to) REFERENCES users(id) ON DELETE SET NULL;

-- ── 3. employees ──────────────────────────────────────────────────────────────
--  Extended profile for users whose role = 'employee'.
--  status mirrors real-time telephony state; is_active on users handles HR.
CREATE TABLE employees (
  id            INT          AUTO_INCREMENT PRIMARY KEY,
  user_id       INT          NOT NULL,
  sip_extension VARCHAR(32)  NOT NULL COMMENT 'Must be unique across all agents',
  sip_password  VARCHAR(64)  NOT NULL,
  status        ENUM('offline','available','on_call','break') NOT NULL DEFAULT 'offline',
  break_status  VARCHAR(32)  NULL COMMENT 'e.g. lunch / short / other',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE  KEY uq_employees_user      (user_id),
  UNIQUE  KEY uq_employees_extension (sip_extension),
  CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Telephony profile for employee-role users';


-- ═════════════════════════════════════════════════════════════════════════════
--  SECTION 2 · ASTERISK PJSIP REALTIME
--  Asterisk reads these tables directly (res_config_mysql).
--  Never edit pjsip.conf for agents or gateways; use sp_provision_* instead.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 4. ps_endpoints ───────────────────────────────────────────────────────────
CREATE TABLE ps_endpoints (
  id                            VARCHAR(40)   NOT NULL  COMMENT 'sip_extension for agents, gw{id} for gateways',
  transport                     VARCHAR(40)   NULL      COMMENT 'transport-wss (agent) | transport-udp (gateway)',
  aors                          VARCHAR(200)  NULL,
  auth                          VARCHAR(200)  NULL,
  context                       VARCHAR(40)   NULL      COMMENT 'from-webrtc (agent) | from-dinstar (gateway)',
  disallow                      VARCHAR(200)  NULL      DEFAULT 'all',
  allow                         VARCHAR(200)  NULL      DEFAULT 'ulaw,alaw',
  direct_media                  VARCHAR(3)    NULL      DEFAULT 'no',
  webrtc                        VARCHAR(3)    NULL      COMMENT 'yes for browser agents',
  dtls_auto_generate_cert       VARCHAR(3)    NULL,
  dtmf_mode                     VARCHAR(40)   NULL      DEFAULT 'rfc4733',
  rtp_symmetric                 VARCHAR(3)    NULL,
  rewrite_contact               VARCHAR(3)    NULL,
  force_rport                   VARCHAR(3)    NULL,
  ice_support                   VARCHAR(3)    NULL,
  outbound_auth                 VARCHAR(40)   NULL,
  outbound_proxy                VARCHAR(40)   NULL,
  send_pai                      VARCHAR(3)    NULL,
  call_group                    VARCHAR(40)   NULL,
  pickup_group                  VARCHAR(40)   NULL,
  set_var                       VARCHAR(200)  NULL,
  -- Less-common fields kept for Asterisk compatibility
  connected_line_method         VARCHAR(40)   NULL,
  direct_media_method           VARCHAR(40)   NULL,
  direct_media_glare_mitigation VARCHAR(40)   NULL,
  disable_direct_media_on_nat   VARCHAR(3)    NULL,
  external_media_address        VARCHAR(40)   NULL,
  identify_by                   VARCHAR(40)   NULL,
  mailboxes                     VARCHAR(40)   NULL,
  moh_suggest                   VARCHAR(40)   NULL,
  redirect_method               VARCHAR(40)   NULL,
  media_address                 VARCHAR(40)   NULL,
  media_encryption              VARCHAR(40)   NULL,
  t38_udptl                     VARCHAR(3)    NULL,
  t38_udptl_ec                  VARCHAR(40)   NULL,
  t38_udptl_maxdatagram         INT           NULL,
  t38_udptl_nat                 VARCHAR(3)    NULL,
  srtp_tag_32                   VARCHAR(3)    NULL,
  use_avpf                      VARCHAR(3)    NULL,
  rtcp_mux                      VARCHAR(3)    NULL,
  bundle                        VARCHAR(3)    NULL,
  `100rel`                      VARCHAR(40)   NULL,
  allow_transfer                VARCHAR(3)    NULL,
  allow_overlap                 VARCHAR(3)    NULL,
  device_state_busy_at          INT           NULL,
  max_audio_streams             INT           NULL,
  max_video_streams             INT           NULL,
  tone_zone                     VARCHAR(40)   NULL,
  language                      VARCHAR(40)   NULL,
  from_domain                   VARCHAR(40)   NULL,
  from_user                     VARCHAR(40)   NULL,
  tos_audio                     VARCHAR(10)   NULL,
  tos_video                     VARCHAR(10)   NULL,
  cos_audio                     INT           NULL,
  cos_video                     INT           NULL,
  rtp_ipv6                      VARCHAR(3)    NULL,
  rtp_engine                    VARCHAR(40)   NULL,
  sdp_owner                     VARCHAR(40)   NULL,
  sdp_session                   VARCHAR(40)   NULL,
  sub_min_expiry                INT           NULL,
  inband_progress               VARCHAR(3)    NULL,
  one_touch_recording           VARCHAR(3)    NULL,
  record_on_feature             VARCHAR(40)   NULL,
  record_off_feature            VARCHAR(40)   NULL,
  named_call_group              VARCHAR(40)   NULL,
  named_pickup_group            VARCHAR(40)   NULL,
  notify_early_inuse_ringing    VARCHAR(3)    NULL,
  refer_blind_progress          VARCHAR(3)    NULL,
  follow_early_media_fork       VARCHAR(3)    NULL,
  accept_multiple_sdp_answers   VARCHAR(3)    NULL,
  suppress_q850_reason_headers  VARCHAR(3)    NULL,
  trust_connected_line          VARCHAR(3)    NULL,
  send_connected_line           VARCHAR(3)    NULL,
  ignore_183_without_sdp        VARCHAR(3)    NULL,
  stir_shaken                   VARCHAR(3)    NULL,
  mwi_from_user                 VARCHAR(40)   NULL,
  incoming_mwi_mailbox          VARCHAR(40)   NULL,
  dtls_verify                   VARCHAR(40)   NULL,
  dtls_rekey                    VARCHAR(40)   NULL,
  dtls_cert_file                VARCHAR(200)  NULL,
  dtls_private_key              VARCHAR(200)  NULL,
  dtls_cipher                   VARCHAR(200)  NULL,
  dtls_ca_file                  VARCHAR(200)  NULL,
  dtls_ca_path                  VARCHAR(200)  NULL,
  dtls_setup                    VARCHAR(40)   NULL,
  dtls_fingerprint              VARCHAR(40)   NULL,
  codec_prefs_incoming_offer    VARCHAR(128)  NULL,
  codec_prefs_outgoing_offer    VARCHAR(128)  NULL,
  codec_prefs_incoming_answer   VARCHAR(128)  NULL,
  codec_prefs_outgoing_answer   VARCHAR(128)  NULL,
  prefer_codec_only             VARCHAR(3)    NULL,
  asymmetric_rtp_codec          VARCHAR(3)    NULL,
  UNIQUE KEY id (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Asterisk PJSIP endpoints (realtime)';

-- ── 5. ps_auths ───────────────────────────────────────────────────────────────
CREATE TABLE ps_auths (
  id             VARCHAR(40) NOT NULL COMMENT '{sip_extension}-auth',
  auth_type      VARCHAR(40) NULL     DEFAULT 'userpass',
  username       VARCHAR(40) NULL,
  password       VARCHAR(80) NULL,
  md5_cred       VARCHAR(40) NULL,
  realm          VARCHAR(40) NULL,
  nonce_lifetime INT         NULL,
  UNIQUE KEY id (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Asterisk PJSIP auth objects (realtime)';

-- ── 6. ps_aors ────────────────────────────────────────────────────────────────
CREATE TABLE ps_aors (
  id                   VARCHAR(40)  NOT NULL,
  contact              VARCHAR(255) NULL COMMENT 'Static contact for gateways, e.g. sip:1.2.3.4:5060',
  max_contacts         INT          NULL,
  remove_existing      VARCHAR(3)   NULL DEFAULT 'yes',
  default_expiry       INT          NULL,
  minimum_expiry       INT          NULL,
  maximum_expiry       INT          NULL,
  qualify_frequency    INT          NULL DEFAULT 30,
  qualify_timeout      FLOAT        NULL,
  authenticate_qualify VARCHAR(3)   NULL,
  outbound_proxy       VARCHAR(40)  NULL,
  support_path         VARCHAR(3)   NULL,
  mailboxes            VARCHAR(80)  NULL,
  voicemail_extension  VARCHAR(40)  NULL,
  UNIQUE KEY id (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Asterisk PJSIP AORs (realtime)';

-- ── 7. ps_endpoint_id_ips ─────────────────────────────────────────────────────
CREATE TABLE ps_endpoint_id_ips (
  id       VARCHAR(40) NOT NULL COMMENT 'gw{id}-identify',
  endpoint VARCHAR(40) NOT NULL COMMENT 'FK by name → ps_endpoints.id',
  `match`  VARCHAR(80) NOT NULL COMMENT 'IP or CIDR of the gateway',
  UNIQUE KEY id (id),
  INDEX idx_ps_id_endpoint (endpoint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Asterisk IP-based endpoint identification (realtime)';


-- ═════════════════════════════════════════════════════════════════════════════
--  SECTION 3 · GSM GATEWAYS
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 8. gsm_gateways ───────────────────────────────────────────────────────────
CREATE TABLE gsm_gateways (
  id                 INT              AUTO_INCREMENT PRIMARY KEY,
  name               VARCHAR(100)     NOT NULL,
  ip                 VARCHAR(64)      NOT NULL,
  port               SMALLINT UNSIGNED NOT NULL DEFAULT 5060,
  channels           SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Total SIM/GSM channels on device',
  status             ENUM('active','inactive') NOT NULL DEFAULT 'active',
  asterisk_endpoint  VARCHAR(100)     NULL  COMMENT 'Auto-set to gw{id} on insert',
  notes              VARCHAR(255)     NULL,
  created_at         DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_gsm_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Physical GSM / VoIP gateway devices';

-- Auto-populate asterisk_endpoint = 'gw{id}' on every new gateway
CREATE TRIGGER trg_gsm_gateway_insert
  BEFORE INSERT ON gsm_gateways
  FOR EACH ROW
    SET NEW.asterisk_endpoint = CONCAT('gw', NEW.id);


-- ═════════════════════════════════════════════════════════════════════════════
--  SECTION 4 · CAMPAIGNS
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 9. campaigns ──────────────────────────────────────────────────────────────
CREATE TABLE campaigns (
  id                  INT      AUTO_INCREMENT PRIMARY KEY,
  name                VARCHAR(150) NOT NULL,
  description         TEXT     NULL,
  script              TEXT     NULL COMMENT 'Agent call script shown in UI',
  created_by          INT      NULL,
  status              ENUM('active','paused','completed') NOT NULL DEFAULT 'active',
  dialer_type         ENUM('predictive','manual','inbound','ratio') NOT NULL DEFAULT 'manual',
  calling_start       TIME     NULL COMMENT 'Allowed call window start (local tz)',
  calling_end         TIME     NULL COMMENT 'Allowed call window end (local tz)',
  retry_count         INT      NOT NULL DEFAULT 0,
  retry_delay_minutes INT      NOT NULL DEFAULT 60,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_camp_status (status),
  CONSTRAINT fk_campaigns_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Dialing campaigns';

-- ── 10. campaign_assignments ──────────────────────────────────────────────────
--  Which agents are assigned to work a campaign.
CREATE TABLE campaign_assignments (
  id          INT      AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT      NOT NULL,
  employee_id INT      NOT NULL COMMENT 'FK → users.id (role=employee)',
  assigned_by INT      NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_assignment (campaign_id, employee_id),
  CONSTRAINT fk_ca_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_ca_employee FOREIGN KEY (employee_id) REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_ca_assigner FOREIGN KEY (assigned_by) REFERENCES users(id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Agent ↔ campaign assignments';

-- ── 11. campaign_gateways ─────────────────────────────────────────────────────
CREATE TABLE campaign_gateways (
  id          INT      AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT      NOT NULL,
  gateway_id  INT      NOT NULL,
  priority    TINYINT  NOT NULL DEFAULT 1 COMMENT '1 = primary, 2 = fallback, etc.',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cg (campaign_id, gateway_id),
  INDEX idx_cg_priority (campaign_id, priority),
  CONSTRAINT fk_cg_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id)    ON DELETE CASCADE,
  CONSTRAINT fk_cg_gateway  FOREIGN KEY (gateway_id)  REFERENCES gsm_gateways(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Which gateways serve each campaign, ordered by priority';

-- ── 12. csv_data ──────────────────────────────────────────────────────────────
--  Uploaded contacts. claimed_at enables atomic dialer claim (no double-dial).
CREATE TABLE csv_data (
  id            INT      AUTO_INCREMENT PRIMARY KEY,
  campaign_id   INT      NOT NULL,
  phone_number  VARCHAR(32)  NOT NULL,
  name          VARCHAR(150) NULL,
  email         VARCHAR(180) NULL,
  company       VARCHAR(150) NULL,
  custom_fields JSON     NULL COMMENT 'Any extra columns from the uploaded CSV',
  called        TINYINT(1) NOT NULL DEFAULT 0,
  call_status   VARCHAR(32)  NULL,
  assigned_to   INT      NULL COMMENT 'FK → users.id: last agent to dial this contact',
  claimed_at    DATETIME NULL COMMENT 'Set atomically by sp_claim_contact; cleared on completion',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_csv_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_csv_assigned FOREIGN KEY (assigned_to) REFERENCES users(id)     ON DELETE SET NULL,
  INDEX idx_csv_dial   (campaign_id, called, claimed_at) COMMENT 'Dialer claim scan',
  INDEX idx_csv_agent  (assigned_to),
  INDEX idx_csv_status (call_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Uploaded contacts per campaign';


-- ═════════════════════════════════════════════════════════════════════════════
--  SECTION 5 · CALL ACTIVITY
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 13. calls ─────────────────────────────────────────────────────────────────
CREATE TABLE calls (
  id               INT      AUTO_INCREMENT PRIMARY KEY,
  employee_id      INT      NOT NULL  COMMENT 'FK → users.id (the agent who made/took the call)',
  campaign_id      INT      NULL,
  csv_data_id      INT      NULL,
  phone_number     VARCHAR(32)  NOT NULL,
  contact_name     VARCHAR(150) NULL,
  direction        ENUM('inbound','outbound') NOT NULL DEFAULT 'outbound',
  status           ENUM('connected','no_answer','busy','failed','voicemail','wrong_number','completed')
                     NOT NULL DEFAULT 'completed',
  duration_seconds INT      NOT NULL DEFAULT 0,
  started_at       DATETIME NULL,
  ended_at         DATETIME NULL,
  recording_url    VARCHAR(255) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_calls_employee FOREIGN KEY (employee_id) REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_calls_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  CONSTRAINT fk_calls_csv      FOREIGN KEY (csv_data_id) REFERENCES csv_data(id)  ON DELETE SET NULL,
  INDEX idx_calls_employee_date  (employee_id, created_at),
  INDEX idx_calls_campaign_date  (campaign_id, created_at) COMMENT 'Campaign reporting',
  INDEX idx_calls_status         (status),
  INDEX idx_calls_direction      (direction)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='One row per call attempt';

-- ── 14. call_notes ────────────────────────────────────────────────────────────
CREATE TABLE call_notes (
  id           INT      AUTO_INCREMENT PRIMARY KEY,
  call_id      INT      NOT NULL,
  employee_id  INT      NOT NULL,
  note         TEXT     NULL,
  disposition  VARCHAR(64) NULL COMMENT 'e.g. interested, not_interested, callback',
  tags         VARCHAR(255) NULL COMMENT 'Comma-separated',
  follow_up_at DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notes_follow_up (follow_up_at),
  CONSTRAINT fk_notes_call     FOREIGN KEY (call_id)     REFERENCES calls(id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Post-call notes and disposition tags';

-- ── 15. scheduled_calls ───────────────────────────────────────────────────────
CREATE TABLE scheduled_calls (
  id           INT      AUTO_INCREMENT PRIMARY KEY,
  call_note_id INT      NULL  COMMENT 'Source note that created this callback',
  phone_number VARCHAR(32)  NOT NULL,
  contact_name VARCHAR(150) NULL,
  scheduled_at DATETIME NOT NULL,
  assigned_to  INT      NOT NULL,
  status       ENUM('pending','done','missed','cancelled') NOT NULL DEFAULT 'pending',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sched_note     FOREIGN KEY (call_note_id) REFERENCES call_notes(id) ON DELETE SET NULL,
  CONSTRAINT fk_sched_assigned FOREIGN KEY (assigned_to)  REFERENCES users(id)      ON DELETE CASCADE,
  INDEX idx_sched_due          (scheduled_at, status),
  INDEX idx_sched_agent_status (assigned_to, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Scheduled callback calls';

-- ── 16. breaks ────────────────────────────────────────────────────────────────
CREATE TABLE breaks (
  id          INT      AUTO_INCREMENT PRIMARY KEY,
  employee_id INT      NOT NULL,
  break_type  ENUM('lunch','short','other') NOT NULL DEFAULT 'short',
  reason      VARCHAR(255) NULL,
  status      ENUM('requested','approved','denied','active','completed') NOT NULL DEFAULT 'requested',
  start_time  DATETIME NULL,
  end_time    DATETIME NULL,
  approved_by INT      NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Computed duration in minutes (generated column, requires MySQL 5.7.6+)
  duration_minutes INT GENERATED ALWAYS AS (
    CASE WHEN start_time IS NOT NULL AND end_time IS NOT NULL
         THEN TIMESTAMPDIFF(MINUTE, start_time, end_time)
         ELSE NULL END
  ) STORED,
  INDEX idx_breaks_employee_date (employee_id, created_at),
  INDEX idx_breaks_status        (status),
  CONSTRAINT fk_breaks_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_breaks_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Break and lunch requests';

-- ── 17. agent_sessions ────────────────────────────────────────────────────────
CREATE TABLE agent_sessions (
  id          INT      AUTO_INCREMENT PRIMARY KEY,
  employee_id INT      NOT NULL,
  login_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  logout_at   DATETIME NULL,
  -- Login duration in seconds (generated, NULL while session is open)
  duration_seconds INT GENERATED ALWAYS AS (
    CASE WHEN logout_at IS NOT NULL
         THEN TIMESTAMPDIFF(SECOND, login_at, logout_at)
         ELSE NULL END
  ) STORED,
  CONSTRAINT fk_as_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_as_employee  (employee_id),
  INDEX idx_as_login     (login_at),
  INDEX idx_as_open      (employee_id, logout_at) COMMENT 'Find open sessions fast'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Agent login / logout sessions';


-- ═════════════════════════════════════════════════════════════════════════════
--  SECTION 6 · OPERATIONS
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 18. performance ───────────────────────────────────────────────────────────
CREATE TABLE performance (
  id                     INT          AUTO_INCREMENT PRIMARY KEY,
  employee_id            INT          NOT NULL,
  date                   DATE         NOT NULL,
  calls_made             INT          NOT NULL DEFAULT 0,
  calls_connected        INT          NOT NULL DEFAULT 0,
  success_rate           DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '(connected/made)*100',
  total_duration_seconds INT          NOT NULL DEFAULT 0,
  break_duration_seconds INT          NOT NULL DEFAULT 0,
  login_duration_seconds INT          NOT NULL DEFAULT 0 COMMENT 'Total session time that day',
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_perf_emp_date (employee_id, date),
  INDEX idx_perf_date    (date),
  CONSTRAINT fk_perf_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Daily rollup per agent';

-- ── 19. audit_logs ────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NULL COMMENT 'Who performed the action (NULL = system)',
  action     VARCHAR(100) NOT NULL COMMENT 'e.g. user.login, campaign.create',
  entity     VARCHAR(60)  NULL COMMENT 'Table name of affected record',
  entity_id  INT          NULL,
  details    JSON         NULL COMMENT 'Before/after or extra context',
  ip         VARCHAR(64)  NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_created        (created_at),
  INDEX idx_audit_entity         (entity, entity_id) COMMENT 'Entity-specific history',
  INDEX idx_audit_user_created   (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Security and change audit trail';

-- ── 20. settings ──────────────────────────────────────────────────────────────
CREATE TABLE settings (
  id            INT          AUTO_INCREMENT PRIMARY KEY,
  setting_key   VARCHAR(80)  NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  description   VARCHAR(255) NULL COMMENT 'Human-readable explanation',
  value_type    ENUM('string','integer','boolean','time','json') NOT NULL DEFAULT 'string',
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_settings_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='System-wide configuration key/value store';


-- ═════════════════════════════════════════════════════════════════════════════
--  SECTION 7 · DEFAULT DATA
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO settings (setting_key, setting_value, description, value_type) VALUES
  ('break_minutes_per_day',    '60',    'Maximum break minutes allowed per agent per day',      'integer'),
  ('max_breaks_per_day',       '4',     'Maximum number of break requests per agent per day',   'integer'),
  ('call_limit_per_day',       '120',   'Maximum outbound calls per agent per day',             'integer'),
  ('work_start',               '09:00', 'Shift start time (HH:MM, server local time)',          'time'),
  ('work_end',                 '18:00', 'Shift end time (HH:MM, server local time)',            'time'),
  ('min_password_length',      '8',     'Minimum characters for user passwords',                'integer'),
  ('recording_retention_days', '90',    'Days to retain call recordings before purging',        'integer'),
  ('dialer_claim_timeout_sec', '30',    'Seconds before an unclaimed csv_data row is released', 'integer'),
  ('predictive_ratio',         '2',     'Calls-to-agents ratio for predictive dialer',          'integer');


-- ═════════════════════════════════════════════════════════════════════════════
--  SECTION 8 · VIEWS
--  These replace ad-hoc joins in the application layer.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── v_agent_full_profile ──────────────────────────────────────────────────────
--  Complete picture of any user: role, team, SIP config, Asterisk endpoint,
--  current gateways (from active campaigns), and real-time status.
--
--  Usage:
--    SELECT * FROM v_agent_full_profile WHERE user_id = 42;
--    SELECT * FROM v_agent_full_profile WHERE sip_extension = '1001';
--    SELECT * FROM v_agent_full_profile WHERE team_id = 3 AND agent_status = 'available';
CREATE OR REPLACE VIEW v_agent_full_profile AS
SELECT
  -- ── User identity ────────────────────────────────────────────────────────
  u.id                                          AS user_id,
  u.name                                        AS user_name,
  u.email,
  u.role,
  u.is_active,

  -- ── Team hierarchy ───────────────────────────────────────────────────────
  t.id                                          AS team_id,
  t.name                                        AS team_name,
  mgr.id                                        AS manager_id,
  mgr.name                                      AS manager_name,
  mgr.email                                     AS manager_email,
  tl.id                                         AS tl_id,
  tl.name                                       AS tl_name,
  tl.email                                      AS tl_email,

  -- ── Employee / telephony profile ─────────────────────────────────────────
  e.id                                          AS employee_id,
  e.sip_extension,
  e.sip_password,
  e.status                                      AS agent_status,
  e.break_status,

  -- ── Asterisk realtime endpoint ────────────────────────────────────────────
  ep.id                                         AS pjsip_endpoint_id,
  ep.transport                                  AS pjsip_transport,
  ep.context                                    AS pjsip_context,
  ep.allow                                      AS pjsip_codecs,
  ep.webrtc                                     AS pjsip_webrtc,
  ep.dtls_auto_generate_cert                    AS pjsip_dtls_auto_cert,
  ep.direct_media                               AS pjsip_direct_media,

  -- ── Asterisk auth ────────────────────────────────────────────────────────
  au.id                                         AS pjsip_auth_id,
  au.auth_type                                  AS pjsip_auth_type,
  au.username                                   AS pjsip_auth_username,
  -- NOTE: password intentionally omitted from view; use sp_get_user if needed

  -- ── Asterisk AOR ─────────────────────────────────────────────────────────
  ao.max_contacts                               AS pjsip_max_contacts,
  ao.remove_existing                            AS pjsip_remove_existing,
  ao.qualify_frequency                          AS pjsip_qualify_freq,

  -- ── Current campaign & gateway (most recent active assignment) ────────────
  ca.campaign_id,
  c.name                                        AS campaign_name,
  c.status                                      AS campaign_status,
  c.dialer_type,
  -- Gateway JSON array for the agent's current campaign
  (
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT(
        'gateway_id',         g.id,
        'gateway_name',       g.name,
        'gateway_ip',         g.ip,
        'gateway_port',       g.port,
        'gateway_channels',   g.channels,
        'gateway_status',     g.status,
        'asterisk_endpoint',  g.asterisk_endpoint,
        'priority',           cg.priority
      )
    )
    FROM campaign_gateways cg
    JOIN gsm_gateways g ON g.id = cg.gateway_id
    WHERE cg.campaign_id = ca.campaign_id
  )                                             AS campaign_gateways_json,

  -- ── Live session ─────────────────────────────────────────────────────────
  sess.id                                       AS active_session_id,
  sess.login_at                                 AS session_login_at,
  TIMESTAMPDIFF(MINUTE, sess.login_at, NOW())   AS session_minutes,

  -- ── Timestamps ───────────────────────────────────────────────────────────
  u.created_at                                  AS user_created_at,
  e.updated_at                                  AS employee_updated_at

FROM users u

  -- Employee profile (NULL for admin/manager/tl)
  LEFT JOIN employees e       ON e.user_id = u.id

  -- Team
  LEFT JOIN teams t           ON t.id = u.team_id
  LEFT JOIN users mgr         ON mgr.id = t.manager_id
  LEFT JOIN users tl          ON tl.id  = t.tl_id

  -- PJSIP realtime tables (keyed on sip_extension)
  LEFT JOIN ps_endpoints ep   ON ep.id = e.sip_extension
  LEFT JOIN ps_auths     au   ON au.id = CONCAT(e.sip_extension, '-auth')
  LEFT JOIN ps_aors      ao   ON ao.id = e.sip_extension

  -- Most recent active campaign assignment
  LEFT JOIN (
    SELECT employee_id, MAX(campaign_id) AS campaign_id
    FROM campaign_assignments
    GROUP BY employee_id
  ) ca                        ON ca.employee_id = u.id
  LEFT JOIN campaigns c       ON c.id = ca.campaign_id AND c.status = 'active'

  -- Open login session
  LEFT JOIN agent_sessions sess ON sess.employee_id = u.id AND sess.logout_at IS NULL
;

-- ── v_active_agents ───────────────────────────────────────────────────────────
--  Quick list of agents currently logged in (open session).
CREATE OR REPLACE VIEW v_active_agents AS
SELECT
  u.id          AS user_id,
  u.name,
  u.email,
  u.team_id,
  t.name        AS team_name,
  e.sip_extension,
  e.status      AS agent_status,
  e.break_status,
  s.login_at,
  TIMESTAMPDIFF(MINUTE, s.login_at, NOW()) AS logged_in_minutes
FROM agent_sessions s
JOIN users     u ON u.id = s.employee_id
JOIN employees e ON e.user_id = u.id
LEFT JOIN teams t ON t.id = u.team_id
WHERE s.logout_at IS NULL
  AND u.is_active = 1
ORDER BY s.login_at;

-- ── v_campaign_status ─────────────────────────────────────────────────────────
--  Campaign progress, assigned agents, and gateway summary.
CREATE OR REPLACE VIEW v_campaign_status AS
SELECT
  c.id                                          AS campaign_id,
  c.name                                        AS campaign_name,
  c.status,
  c.dialer_type,
  c.calling_start,
  c.calling_end,

  -- Contact stats
  COUNT(DISTINCT csv.id)                        AS total_contacts,
  SUM(csv.called)                               AS contacts_called,
  SUM(csv.called = 0 AND csv.claimed_at IS NULL) AS contacts_available,
  SUM(csv.claimed_at IS NOT NULL AND csv.called = 0) AS contacts_claimed,

  -- Agent count
  COUNT(DISTINCT ca.employee_id)                AS assigned_agents,

  -- Gateway summary
  COUNT(DISTINCT cg.gateway_id)                 AS total_gateways,
  SUM(g.channels)                               AS total_channels,
  GROUP_CONCAT(DISTINCT g.name ORDER BY cg.priority SEPARATOR ', ')
                                                AS gateway_names,

  c.created_at
FROM campaigns c
  LEFT JOIN csv_data           csv ON csv.campaign_id = c.id
  LEFT JOIN campaign_assignments ca ON ca.campaign_id  = c.id
  LEFT JOIN campaign_gateways  cg  ON cg.campaign_id  = c.id
  LEFT JOIN gsm_gateways       g   ON g.id = cg.gateway_id AND g.status = 'active'
GROUP BY c.id;

-- ── v_upcoming_callbacks ──────────────────────────────────────────────────────
--  Pending scheduled calls due within the next 24 hours.
CREATE OR REPLACE VIEW v_upcoming_callbacks AS
SELECT
  sc.id              AS scheduled_call_id,
  sc.phone_number,
  sc.contact_name,
  sc.scheduled_at,
  TIMESTAMPDIFF(MINUTE, NOW(), sc.scheduled_at) AS due_in_minutes,
  u.id               AS agent_id,
  u.name             AS agent_name,
  u.email            AS agent_email,
  e.sip_extension,
  cn.note            AS original_note,
  cn.disposition,
  sc.created_at
FROM scheduled_calls sc
JOIN users     u  ON u.id = sc.assigned_to
JOIN employees e  ON e.user_id = u.id
LEFT JOIN call_notes cn ON cn.id = sc.call_note_id
WHERE sc.status = 'pending'
  AND sc.scheduled_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 24 HOUR)
ORDER BY sc.scheduled_at;


-- ═════════════════════════════════════════════════════════════════════════════
--  SECTION 9 · STORED PROCEDURES
-- ═════════════════════════════════════════════════════════════════════════════

DELIMITER $$

-- ── sp_get_user ───────────────────────────────────────────────────────────────
--  Full profile + SIP password (admin use only — guard in app layer).
--
--  Usage:
--    CALL sp_get_user(42);          -- by user id
--    CALL sp_get_user(NULL, '1001');-- by sip_extension (pass NULL for id)
--
DROP PROCEDURE IF EXISTS sp_get_user$$
CREATE PROCEDURE sp_get_user(
  IN p_user_id      INT,
  IN p_sip_ext      VARCHAR(32)
)
BEGIN
  -- Full profile row (same as v_agent_full_profile but includes sip_password)
  SELECT
    u.id            AS user_id,
    u.name,
    u.email,
    u.role,
    u.is_active,
    t.id            AS team_id,
    t.name          AS team_name,
    mgr.name        AS manager_name,
    mgr.email       AS manager_email,
    tl.name         AS tl_name,
    tl.email        AS tl_email,
    e.sip_extension,
    e.sip_password,   -- included here, not in public view
    e.status        AS agent_status,
    e.break_status,
    ep.transport    AS pjsip_transport,
    ep.context      AS pjsip_context,
    ep.allow        AS pjsip_codecs,
    ep.webrtc       AS pjsip_webrtc,
    ep.direct_media AS pjsip_direct_media,
    au.id           AS pjsip_auth_id,
    au.auth_type,
    au.username     AS pjsip_username,
    au.password     AS pjsip_password,
    ao.max_contacts,
    ao.qualify_frequency
  FROM users u
    LEFT JOIN employees e   ON e.user_id = u.id
    LEFT JOIN teams t       ON t.id = u.team_id
    LEFT JOIN users mgr     ON mgr.id = t.manager_id
    LEFT JOIN users tl      ON tl.id  = t.tl_id
    LEFT JOIN ps_endpoints ep ON ep.id = e.sip_extension
    LEFT JOIN ps_auths     au ON au.id = CONCAT(e.sip_extension, '-auth')
    LEFT JOIN ps_aors      ao ON ao.id = e.sip_extension
  WHERE (p_user_id IS NOT NULL AND u.id = p_user_id)
     OR (p_sip_ext IS NOT NULL AND e.sip_extension = p_sip_ext)
  LIMIT 1;

  -- Active campaign(s) with gateway details
  SELECT
    ca.campaign_id,
    c.name          AS campaign_name,
    c.status        AS campaign_status,
    c.dialer_type,
    cg.priority     AS gateway_priority,
    g.id            AS gateway_id,
    g.name          AS gateway_name,
    g.ip            AS gateway_ip,
    g.port          AS gateway_port,
    g.channels      AS gateway_channels,
    g.asterisk_endpoint,
    g.status        AS gateway_status,
    eip.`match`     AS gateway_ip_match
  FROM campaign_assignments ca
    JOIN campaigns c         ON c.id  = ca.campaign_id
    JOIN campaign_gateways cg ON cg.campaign_id = c.id
    JOIN gsm_gateways g      ON g.id = cg.gateway_id
    LEFT JOIN ps_endpoint_id_ips eip ON eip.endpoint = g.asterisk_endpoint
  WHERE ca.employee_id = COALESCE(p_user_id,
          (SELECT user_id FROM employees WHERE sip_extension = p_sip_ext))
    AND c.status = 'active'
  ORDER BY ca.campaign_id, cg.priority;

  -- Open login session
  SELECT
    id              AS session_id,
    login_at,
    TIMESTAMPDIFF(MINUTE, login_at, NOW()) AS logged_in_minutes
  FROM agent_sessions
  WHERE employee_id = COALESCE(p_user_id,
          (SELECT user_id FROM employees WHERE sip_extension = p_sip_ext))
    AND logout_at IS NULL
  ORDER BY login_at DESC
  LIMIT 1;

  -- Today's performance snapshot
  SELECT
    calls_made,
    calls_connected,
    success_rate,
    ROUND(total_duration_seconds / 60, 1) AS total_call_minutes,
    ROUND(break_duration_seconds  / 60, 1) AS break_minutes_used,
    ROUND(login_duration_seconds  / 60, 1) AS login_minutes
  FROM performance
  WHERE employee_id = COALESCE(p_user_id,
          (SELECT user_id FROM employees WHERE sip_extension = p_sip_ext))
    AND date = CURDATE();
END$$


-- ── sp_claim_contact ──────────────────────────────────────────────────────────
--  Atomically claim the next uncalled contact for an agent.
--  Prevents two agents dialling the same number simultaneously.
--
--  Returns one row: the claimed contact, or empty if none available.
--
--  Usage:
--    CALL sp_claim_contact(5, 12);   -- campaign_id=5, agent user_id=12
--
DROP PROCEDURE IF EXISTS sp_claim_contact$$
CREATE PROCEDURE sp_claim_contact(
  IN p_campaign_id  INT,
  IN p_agent_id     INT
)
BEGIN
  DECLARE v_contact_id INT DEFAULT NULL;
  DECLARE v_timeout    INT DEFAULT 30;

  -- Read configured claim timeout
  SELECT CAST(setting_value AS UNSIGNED) INTO v_timeout
  FROM settings WHERE setting_key = 'dialer_claim_timeout_sec' LIMIT 1;

  -- Atomic claim: grab a single uncalled/expired row
  UPDATE csv_data
  SET    assigned_to = p_agent_id,
         claimed_at  = NOW()
  WHERE  campaign_id = p_campaign_id
    AND  called = 0
    AND  (claimed_at IS NULL OR claimed_at < DATE_SUB(NOW(), INTERVAL v_timeout SECOND))
  ORDER BY id
  LIMIT  1;

  -- Find the row we just claimed
  SELECT id INTO v_contact_id
  FROM csv_data
  WHERE campaign_id = p_campaign_id
    AND assigned_to = p_agent_id
    AND called = 0
    AND claimed_at >= DATE_SUB(NOW(), INTERVAL v_timeout SECOND)
  ORDER BY claimed_at DESC
  LIMIT 1;

  -- Return claimed contact (empty result = no contacts left)
  SELECT id, phone_number, name, email, company, custom_fields, claimed_at
  FROM   csv_data
  WHERE  id = v_contact_id;
END$$


-- ── sp_close_session ──────────────────────────────────────────────────────────
--  Cleanly logs an agent out: closes open session, sets status offline.
--
--  Usage:
--    CALL sp_close_session(12);   -- user_id = 12
--
DROP PROCEDURE IF EXISTS sp_close_session$$
CREATE PROCEDURE sp_close_session(IN p_employee_id INT)
BEGIN
  UPDATE agent_sessions
  SET    logout_at = NOW()
  WHERE  employee_id = p_employee_id
    AND  logout_at IS NULL;

  UPDATE employees
  SET    status = 'offline', break_status = NULL
  WHERE  user_id = p_employee_id;
END$$


-- ── sp_daily_rollup ───────────────────────────────────────────────────────────
--  Recalculates performance table for every agent on a given date.
--  Safe to call multiple times (upserts).
--
--  Usage:
--    CALL sp_daily_rollup(CURDATE());          -- today
--    CALL sp_daily_rollup('2025-05-30');       -- a specific past date
--
DROP PROCEDURE IF EXISTS sp_daily_rollup$$
CREATE PROCEDURE sp_daily_rollup(IN p_date DATE)
BEGIN
  INSERT INTO performance
    (employee_id, date,
     calls_made, calls_connected, success_rate,
     total_duration_seconds, break_duration_seconds, login_duration_seconds)
  SELECT
    u.id                                          AS employee_id,
    p_date                                        AS date,
    COUNT(c.id)                                   AS calls_made,
    SUM(c.status = 'connected')                   AS calls_connected,
    ROUND(
      SUM(c.status = 'connected') / NULLIF(COUNT(c.id), 0) * 100, 2
    )                                             AS success_rate,
    COALESCE(SUM(c.duration_seconds), 0)          AS total_duration_seconds,
    COALESCE(
      (SELECT SUM(b.duration_minutes) * 60
       FROM breaks b
       WHERE b.employee_id = u.id
         AND DATE(b.start_time) = p_date
         AND b.status = 'completed'), 0
    )                                             AS break_duration_seconds,
    COALESCE(
      (SELECT SUM(
         TIMESTAMPDIFF(SECOND, s.login_at,
           LEAST(COALESCE(s.logout_at, NOW()),
                 TIMESTAMP(p_date, '23:59:59')))
       )
       FROM agent_sessions s
       WHERE s.employee_id = u.id
         AND DATE(s.login_at) = p_date), 0
    )                                             AS login_duration_seconds
  FROM users u
    LEFT JOIN calls c ON c.employee_id = u.id
                      AND DATE(c.created_at) = p_date
  WHERE u.role = 'employee'
    AND u.is_active = 1
  GROUP BY u.id

  ON DUPLICATE KEY UPDATE
    calls_made             = VALUES(calls_made),
    calls_connected        = VALUES(calls_connected),
    success_rate           = VALUES(success_rate),
    total_duration_seconds = VALUES(total_duration_seconds),
    break_duration_seconds = VALUES(break_duration_seconds),
    login_duration_seconds = VALUES(login_duration_seconds),
    updated_at             = NOW();
END$$

DELIMITER ;


-- ═════════════════════════════════════════════════════════════════════════════
--  SECTION 10 · TRIGGERS
-- ═════════════════════════════════════════════════════════════════════════════

-- ── trg_call_insert_mark_csv ──────────────────────────────────────────────────
--  When a call row is created for a csv contact, mark it as called
--  and clear the claim so the next dialer pick-up works correctly.
DELIMITER $$
CREATE TRIGGER trg_call_insert_mark_csv
  AFTER INSERT ON calls
  FOR EACH ROW
BEGIN
  IF NEW.csv_data_id IS NOT NULL THEN
    UPDATE csv_data
    SET    called      = 1,
           call_status = NEW.status,
           claimed_at  = NULL
    WHERE  id = NEW.csv_data_id;
  END IF;
END$$

-- ── trg_break_complete_status ─────────────────────────────────────────────────
--  When a break is marked completed or denied, restore employee status
--  to 'available' (assuming they are still logged in).
CREATE TRIGGER trg_break_complete_status
  AFTER UPDATE ON breaks
  FOR EACH ROW
BEGIN
  IF NEW.status IN ('completed', 'denied') AND OLD.status NOT IN ('completed', 'denied') THEN
    UPDATE employees
    SET    status = 'available', break_status = NULL
    WHERE  user_id = NEW.employee_id
      AND  status  = 'break';
  END IF;
END$$

-- ── trg_session_logout_status ─────────────────────────────────────────────────
--  When an agent session is closed (logout_at filled), set them offline.
CREATE TRIGGER trg_session_logout_status
  AFTER UPDATE ON agent_sessions
  FOR EACH ROW
BEGIN
  IF NEW.logout_at IS NOT NULL AND OLD.logout_at IS NULL THEN
    UPDATE employees
    SET    status = 'offline', break_status = NULL
    WHERE  user_id = NEW.employee_id;
  END IF;
END$$

DELIMITER ;


-- ═════════════════════════════════════════════════════════════════════════════
--  SECTION 11 · ASTERISK REALTIME BACKFILL
--  Run this block after the schema is loaded to sync existing data into
--  the ps_* tables. After this, the app keeps them in sync automatically.
-- ═════════════════════════════════════════════════════════════════════════════

-- Agents → WebRTC endpoints
INSERT INTO ps_endpoints
  (id, transport, aors, auth, context, disallow, allow, webrtc, dtls_auto_generate_cert, direct_media)
SELECT
  e.sip_extension, 'transport-wss', e.sip_extension,
  CONCAT(e.sip_extension, '-auth'), 'from-webrtc',
  'all', 'ulaw,alaw', 'yes', 'yes', 'no'
FROM employees e
JOIN users u ON u.id = e.user_id
WHERE u.is_active = 1
ON DUPLICATE KEY UPDATE
  transport = VALUES(transport), aors = VALUES(aors), auth = VALUES(auth),
  context = VALUES(context), allow = VALUES(allow), webrtc = VALUES(webrtc),
  dtls_auto_generate_cert = VALUES(dtls_auto_generate_cert), direct_media = VALUES(direct_media);

INSERT INTO ps_auths (id, auth_type, username, password)
SELECT CONCAT(e.sip_extension, '-auth'), 'userpass', e.sip_extension, e.sip_password
FROM employees e JOIN users u ON u.id = e.user_id WHERE u.is_active = 1
ON DUPLICATE KEY UPDATE username = VALUES(username), password = VALUES(password);

INSERT INTO ps_aors (id, max_contacts, remove_existing, qualify_frequency)
SELECT e.sip_extension, 1, 'yes', 0
FROM employees e JOIN users u ON u.id = e.user_id WHERE u.is_active = 1
ON DUPLICATE KEY UPDATE max_contacts = VALUES(max_contacts), remove_existing = VALUES(remove_existing);

-- Gateways → UDP trunk endpoints
INSERT INTO ps_endpoints
  (id, transport, aors, context, disallow, allow, direct_media, rtp_symmetric, rewrite_contact)
SELECT
  CONCAT('gw', id), 'transport-udp', CONCAT('gw', id), 'from-dinstar',
  'all', 'ulaw,alaw', 'no', 'yes', 'yes'
FROM gsm_gateways WHERE status = 'active'
ON DUPLICATE KEY UPDATE
  transport = VALUES(transport), aors = VALUES(aors), context = VALUES(context),
  disallow = VALUES(disallow), allow = VALUES(allow), direct_media = VALUES(direct_media),
  rtp_symmetric = VALUES(rtp_symmetric), rewrite_contact = VALUES(rewrite_contact);

INSERT INTO ps_aors (id, contact, qualify_frequency)
SELECT CONCAT('gw', id), CONCAT('sip:', ip, ':', port), 30
FROM gsm_gateways WHERE status = 'active'
ON DUPLICATE KEY UPDATE contact = VALUES(contact), qualify_frequency = VALUES(qualify_frequency);

INSERT INTO ps_endpoint_id_ips (id, endpoint, `match`)
SELECT CONCAT('gw', id, '-identify'), CONCAT('gw', id), ip
FROM gsm_gateways WHERE status = 'active'
ON DUPLICATE KEY UPDATE endpoint = VALUES(endpoint), `match` = VALUES(`match`);


-- ═════════════════════════════════════════════════════════════════════════════
--  QUICK REFERENCE
-- ═════════════════════════════════════════════════════════════════════════════
--
--  ── Find everything about a user (by id or SIP extension) ─────────────────
--    CALL sp_get_user(42, NULL);          -- by user id
--    CALL sp_get_user(NULL, '1001');      -- by sip_extension
--
--  ── Same but as a single wide row (no SIP password) ───────────────────────
--    SELECT * FROM v_agent_full_profile WHERE user_id = 42;
--    SELECT * FROM v_agent_full_profile WHERE sip_extension = '1001';
--
--  ── All agents currently online ────────────────────────────────────────────
--    SELECT * FROM v_active_agents;
--
--  ── Campaign progress at a glance ──────────────────────────────────────────
--    SELECT * FROM v_campaign_status WHERE campaign_id = 3;
--
--  ── Callbacks due in the next hour ────────────────────────────────────────
--    SELECT * FROM v_upcoming_callbacks WHERE due_in_minutes <= 60;
--
--  ── Atomic dialer claim ────────────────────────────────────────────────────
--    CALL sp_claim_contact(5, 12);        -- campaign_id=5, agent=12
--
--  ── Close agent session cleanly ────────────────────────────────────────────
--    CALL sp_close_session(12);
--
--  ── Refresh today's performance stats ─────────────────────────────────────
--    CALL sp_daily_rollup(CURDATE());
--
-- ═════════════════════════════════════════════════════════════════════════════

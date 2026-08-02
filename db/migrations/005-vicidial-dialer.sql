-- =====================================================================
--  005-vicidial-dialer.sql — new TABLES for the VICIdial-style dialer.
--
--  Only CREATE TABLE IF NOT EXISTS lives here (safe to re-run). Column
--  additions to existing tables are done conditionally by the runner,
--  db/migrate-vicidial.mjs, because MySQL 8 has no ADD COLUMN IF NOT EXISTS.
-- =====================================================================

-- ---- dialer_log: the per-lead event trail (requirement: full lifecycle logs)
-- Deliberately has NO foreign keys: a log row must never block or cascade with
-- the lead/call it describes, and it must survive a list or campaign delete.
CREATE TABLE IF NOT EXISTS dialer_log (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  csv_data_id INT NULL,
  campaign_id INT NULL,
  list_id     INT NULL,
  call_id     INT NULL,
  agent_id    INT NULL,
  gateway_id  INT NULL,
  event       VARCHAR(40) NOT NULL COMMENT 'selected|reserved|dial_started|ringing|answered|connected|failed|retry_scheduled|retry_attempt|disposition|completed|released|recovered',
  status_from VARCHAR(32) NULL,
  status_to   VARCHAR(32) NULL,
  detail      JSON NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_dl_lead (csv_data_id, id),
  INDEX idx_dl_campaign (campaign_id, created_at),
  INDEX idx_dl_event (event, created_at),
  INDEX idx_dl_call (call_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- pending_recordings: ARI writes a row when bridge recording starts, the
-- disposition route consumes it and stamps calls.recording_url.
-- (Already present on live databases; created here so a fresh install works.)
CREATE TABLE IF NOT EXISTS pending_recordings (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  extension    VARCHAR(20) NOT NULL,
  phone_number VARCHAR(32) NOT NULL,
  filename     VARCHAR(255) NOT NULL,
  consumed     TINYINT(1) NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_match (extension, phone_number, consumed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

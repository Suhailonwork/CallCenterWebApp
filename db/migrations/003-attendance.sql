-- =====================================================================
--  003-attendance.sql — Attendance & Login Tracking (ADDITIVE migration)
--
--  Run with:  npm run db:migrate:attendance   (db/migrate-attendance.mjs)
--  Safe to run on a live database: CREATE TABLE IF NOT EXISTS only.
--  The users.shift_id column is added conditionally by the runner.
--
--  Design notes:
--    * Attendance is NEVER stored on the users/employees row — every login
--      is one immutable row in attendance_sessions. Historical data is kept
--      forever; nothing is overwritten.
--    * shift_id / tl_id / role are SNAPSHOT into each attendance row at login
--      time, so reassigning a shift or TL later never rewrites history.
--    * Calendar day is the IST (Asia/Kolkata) work_date, computed by the app.
-- =====================================================================

-- ---- shifts: admin-defined shift windows employees are assigned to ----
CREATE TABLE IF NOT EXISTS shifts (
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

-- ---- attendance_sessions: one row per login (the source of truth) ----
CREATE TABLE IF NOT EXISTS attendance_sessions (
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

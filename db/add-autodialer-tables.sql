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

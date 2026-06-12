-- =====================================================================
--  001-groups.sql — Group-Based Campaign Management (ADDITIVE migration)
--
--  Run with:  npm run db:migrate:groups   (executes db/migrate-groups.mjs)
--  Safe to run on a live database: only CREATE TABLE IF NOT EXISTS here.
--  The campaigns.group_id column is added conditionally by the runner.
--
--  NOTE: `groups` is a reserved word in MySQL 8 — always backtick it.
-- =====================================================================

-- ---- groups: a named unit of TLs + agents that owns campaigns ----
CREATE TABLE IF NOT EXISTS `groups` (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(500) NULL,
  created_by  INT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_groups_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- group_tl: which Team Leads run a group (a group can have several) ----
CREATE TABLE IF NOT EXISTS group_tl (
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
CREATE TABLE IF NOT EXISTS group_agents (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  group_id   INT NOT NULL,
  agent_id   INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_group_agent (group_id, agent_id),
  CONSTRAINT fk_ga_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  CONSTRAINT fk_ga_user  FOREIGN KEY (agent_id) REFERENCES users(id)    ON DELETE CASCADE,
  INDEX idx_ga_agent (agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

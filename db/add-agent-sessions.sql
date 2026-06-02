-- Adds the agent_sessions table that was missing from schema.sql.
DROP TABLE IF EXISTS agent_sessions;
CREATE TABLE agent_sessions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  login_at    DATETIME NOT NULL,
  logout_at   DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_agent_sessions_emp (employee_id, login_at),
  CONSTRAINT fk_agent_sessions_user FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

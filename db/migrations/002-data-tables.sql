-- =====================================================================
--  002-data-tables.sql — Reusable Data Tables (ADDITIVE migration)
--
--  Run with:  npm run db:migrate:data-tables   (executes db/migrate-data-tables.mjs)
--  Safe to run on a live database: only CREATE TABLE IF NOT EXISTS here.
--  The campaigns.data_table_id column is added conditionally by the runner.
--
--  A data_table is just a named, ordered list of column names. It does NOT
--  create any dynamic SQL tables — contact cell values keep living in the
--  existing csv_data.custom_fields JSON column.
-- =====================================================================

-- ---- data_tables: reusable, ordered column-name sets for CSV uploads ----
CREATE TABLE IF NOT EXISTS data_tables (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  columns    JSON NOT NULL COMMENT 'Ordered array of column names',
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_data_tables_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

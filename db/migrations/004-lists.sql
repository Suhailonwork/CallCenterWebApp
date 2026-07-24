-- =====================================================================
--  004-lists.sql — VICIdial-style Lists layer (ADDITIVE migration)
--
--  Run with:  npm run db:migrate:lists   (executes db/migrate-lists.mjs)
--  Safe on a live database: only CREATE TABLE IF NOT EXISTS here. All
--  column additions on csv_data / campaigns are done conditionally by the
--  runner (information_schema checks), and the backfill is idempotent.
--
--  Model: a campaign is only RULES. Leads always belong to a LIST; a list
--  belongs to exactly ONE campaign and has an ON/OFF switch (`active`).
--  The dialer claims leads only from lists with active='Y'.
--
--  Reverse with:  npm run db:rollback:lists  (db/rollback-lists.mjs)
-- =====================================================================

-- ---- lists: a data container of leads, owned by one campaign ----
CREATE TABLE IF NOT EXISTS lists (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  description VARCHAR(500) NULL,
  campaign_id INT NOT NULL,
  active      ENUM('Y','N') NOT NULL DEFAULT 'N',
  template_id INT NULL COMMENT 'Data Template (data_tables.id) applied to CSV uploads into this list',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lists_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id)   ON DELETE CASCADE,
  CONSTRAINT fk_lists_template FOREIGN KEY (template_id) REFERENCES data_tables(id) ON DELETE SET NULL,
  -- One list name per campaign — also stops a check-then-insert race from
  -- creating two "Default List" rows for the same campaign.
  UNIQUE KEY uq_lists_campaign_name (campaign_id, name),
  -- Hot path: the claim query resolves "this campaign's active lists".
  INDEX idx_lists_campaign_active (campaign_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

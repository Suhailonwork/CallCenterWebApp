-- -- Atomic claim support for csv_data so two agents never dial the same contact.
-- -- Run once:  mysql -u root -p callcenter < db/add-csv-claim.sql
-- USE callcenter;

-- ALTER TABLE csv_data
--   ADD COLUMN claimed_at DATETIME NULL AFTER assigned_to;

-- CREATE INDEX idx_csv_claim ON csv_data (campaign_id, called, claimed_at);

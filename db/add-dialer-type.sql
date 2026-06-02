-- -- Migration: add dialer_type column to campaigns
-- -- Run once against your existing database.

-- ALTER TABLE campaigns
--   ADD COLUMN dialer_type ENUM('predictive','manual','inbound','ratio')
--     NOT NULL DEFAULT 'manual'
--     AFTER status;

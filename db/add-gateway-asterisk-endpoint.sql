-- -- Migration: add asterisk_endpoint column to gsm_gateways
-- -- This maps each gateway to its PJSIP endpoint name in Asterisk (e.g. "dinstar").
-- -- Run once against your existing database.

-- ALTER TABLE gsm_gateways
--   ADD COLUMN asterisk_endpoint VARCHAR(100) NULL
--     COMMENT 'PJSIP endpoint name in Asterisk, e.g. dinstar'
--     AFTER status;

-- -- If you only have one gateway and it uses the "dinstar" endpoint, run this too:
-- -- UPDATE gsm_gateways SET asterisk_endpoint = 'dinstar';

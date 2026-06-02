-- -- Migration: Set asterisk_endpoint = 'gw{id}' for all existing gateways
-- -- and clean up stale ps_* entries, then reprovision correctly.
-- -- Run once on your callcenter database.

-- USE callcenter;

-- -- Step 1: Set asterisk_endpoint to gw{id} for all gateways
-- UPDATE gsm_gateways SET asterisk_endpoint = CONCAT('gw', id);

-- -- Step 2: Clean up all gateway entries in realtime tables (keep only employee entries)
-- SET SQL_SAFE_UPDATES = 0;
-- DELETE FROM ps_endpoints        WHERE id NOT REGEXP '^[0-9]+$';
-- DELETE FROM ps_auths            WHERE id NOT REGEXP '^[0-9]';
-- DELETE FROM ps_aors             WHERE id NOT REGEXP '^[0-9]+$';
-- DELETE FROM ps_endpoint_id_ips  WHERE id IS NOT NULL;
-- SET SQL_SAFE_UPDATES = 1;

-- -- Step 3: Re-insert gateways with correct gw{id} names
-- INSERT INTO ps_endpoints (id, transport, aors, context, disallow, allow, direct_media, rtp_symmetric, rewrite_contact)
-- SELECT CONCAT('gw', id), 'transport-udp', CONCAT('gw', id), 'from-dinstar', 'all', 'ulaw,alaw', 'no', 'yes', 'yes'
-- FROM gsm_gateways WHERE status = 'active';

-- INSERT INTO ps_aors (id, contact, qualify_frequency)
-- SELECT CONCAT('gw', id), CONCAT('sip:', ip, ':', port), 30
-- FROM gsm_gateways WHERE status = 'active';

-- INSERT INTO ps_endpoint_id_ips (id, endpoint, `match`)
-- SELECT CONCAT('gw', id, '-identify'), CONCAT('gw', id), ip
-- FROM gsm_gateways WHERE status = 'active';

-- -- ─────────────────────────────────────────────────────────────────
-- --  Backfill realtime PJSIP tables from existing app data.
-- --
-- --  Run ONCE, after creating the realtime tables, to load agents and
-- --  gateways that already existed before realtime was switched on:
-- --
-- --    mysql -u root -p callcenter < db/asterisk-realtime-tables.sql   # tables
-- --    mysql -u root -p callcenter < db/backfill-realtime-endpoints.sql # this file
-- --
-- --  After this, the admin panel keeps the ps_* tables in sync
-- --  automatically (provisionEmployeeEndpoint / provisionGatewayEndpoint).
-- --  Column values below MUST match src/lib/asteriskRealtime.ts.
-- -- ─────────────────────────────────────────────────────────────────

-- USE callcenter;

-- -- ── Employees → WebRTC endpoints ─────────────────────────────────
-- INSERT INTO ps_endpoints
--   (id, transport, aors, auth, context, disallow, allow, webrtc, dtls_auto_generate_cert, direct_media)
-- SELECT e.sip_extension, 'transport-wss', e.sip_extension, CONCAT(e.sip_extension, '-auth'),
--        'from-webrtc', 'all', 'ulaw,alaw', 'yes', 'yes', 'no'
-- FROM employees e JOIN users u ON u.id = e.user_id
-- WHERE u.is_active = 1
-- ON DUPLICATE KEY UPDATE
--   transport=VALUES(transport), aors=VALUES(aors), auth=VALUES(auth), context=VALUES(context),
--   disallow=VALUES(disallow), allow=VALUES(allow), webrtc=VALUES(webrtc),
--   dtls_auto_generate_cert=VALUES(dtls_auto_generate_cert), direct_media=VALUES(direct_media);

-- INSERT INTO ps_auths (id, auth_type, username, password)
-- SELECT CONCAT(e.sip_extension, '-auth'), 'userpass', e.sip_extension, e.sip_password
-- FROM employees e JOIN users u ON u.id = e.user_id
-- WHERE u.is_active = 1
-- ON DUPLICATE KEY UPDATE username=VALUES(username), password=VALUES(password);

-- INSERT INTO ps_aors (id, max_contacts, remove_existing)
-- SELECT e.sip_extension, 1, 'yes'
-- FROM employees e JOIN users u ON u.id = e.user_id
-- WHERE u.is_active = 1
-- ON DUPLICATE KEY UPDATE max_contacts=VALUES(max_contacts), remove_existing=VALUES(remove_existing);

-- -- ── GSM gateways → trunk endpoints (named gw{id}) ────────────────
-- UPDATE gsm_gateways SET asterisk_endpoint = CONCAT('gw', id);

-- INSERT INTO ps_endpoints
--   (id, transport, aors, context, disallow, allow, direct_media, rtp_symmetric, rewrite_contact)
-- SELECT CONCAT('gw', id), 'transport-udp', CONCAT('gw', id), 'from-dinstar',
--        'all', 'ulaw,alaw', 'no', 'yes', 'yes'
-- FROM gsm_gateways WHERE status = 'active'
-- ON DUPLICATE KEY UPDATE
--   transport=VALUES(transport), aors=VALUES(aors), context=VALUES(context),
--   disallow=VALUES(disallow), allow=VALUES(allow), direct_media=VALUES(direct_media),
--   rtp_symmetric=VALUES(rtp_symmetric), rewrite_contact=VALUES(rewrite_contact);

-- INSERT INTO ps_aors (id, contact, qualify_frequency)
-- SELECT CONCAT('gw', id), CONCAT('sip:', ip, ':', port), 30
-- FROM gsm_gateways WHERE status = 'active'
-- ON DUPLICATE KEY UPDATE contact=VALUES(contact), qualify_frequency=VALUES(qualify_frequency);

-- INSERT INTO ps_endpoint_id_ips (id, endpoint, `match`)
-- SELECT CONCAT('gw', id, '-identify'), CONCAT('gw', id), ip
-- FROM gsm_gateways WHERE status = 'active'
-- ON DUPLICATE KEY UPDATE endpoint=VALUES(endpoint), `match`=VALUES(`match`);

-- -- Sanity check
-- SELECT id, transport, context FROM ps_endpoints ORDER BY id;

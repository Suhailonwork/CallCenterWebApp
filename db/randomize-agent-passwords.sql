-- -- Give every existing agent a unique random SIP password (16 hex chars) and
-- -- sync Asterisk's realtime auth table so they keep authenticating.
-- -- Run once:  mysql -u root -p callcenter < db/randomize-agent-passwords.sql
-- -- Agents re-register automatically (their browser re-fetches /api/employee/sip).
-- USE callcenter;

-- UPDATE employees SET sip_password = SUBSTRING(MD5(RAND()), 1, 16);

-- -- Sync realtime auth rows (no-op if you use static pjsip.conf instead).
-- UPDATE ps_auths a
--   JOIN employees e ON a.id = CONCAT(e.sip_extension, '-auth')
--    SET a.password = e.sip_password;

-- SELECT sip_extension, sip_password FROM employees ORDER BY sip_extension;

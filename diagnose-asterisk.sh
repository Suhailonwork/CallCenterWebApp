#!/usr/bin/env bash
# Run this ON the Asterisk server (100.106.191.36).
# It checks every layer between the app and Asterisk and prints a verdict.
echo "================ 1. res_config_mysql module loaded? ================"
asterisk -rx "module show like res_config_mysql" 2>&1 | grep -iE "res_config_mysql|module" || echo "  -> module NOT loaded"
echo
echo "================ 2. PJSIP endpoints Asterisk can see ================"
asterisk -rx "pjsip show endpoints" 2>&1
echo
echo "================ 3. AOR contacts / qualify status =================="
asterisk -rx "pjsip show aors" 2>&1
echo
echo "================ 4. Rows in the realtime DB tables ================="
mysql -u root -pPassword123 callcenter -e \
 "SELECT 'ps_endpoints' tbl, id FROM ps_endpoints
  UNION ALL SELECT 'ps_aors', id FROM ps_aors
  UNION ALL SELECT 'ps_endpoint_id_ips', id FROM ps_endpoint_id_ips;" 2>&1
echo
echo "================ 5. Gateway rows in the app table =================="
mysql -u root -pPassword123 callcenter -e \
 "SELECT id, name, ip, port, status, asterisk_endpoint FROM gsm_gateways;" 2>&1
echo
echo "================ 6. ARI reachable + endpoint state ================="
echo "(replace gw1 below with the asterisk_endpoint shown in step 5)"
curl -s -u admin:adminsecret http://localhost:8088/ari/endpoints/PJSIP/gw1 || echo "  -> ARI not reachable"
echo
echo "==================== VERDICT GUIDE ===================="
echo "- Step 2 empty  => realtime not serving. Check step 1 (module) + step 4 (rows)."
echo "- Step 4 empty  => run: mysql -u root -p callcenter < db/backfill-realtime-endpoints.sql"
echo "- Step 1 not Running => res_config_mysql.so not built/loaded (add-on)."
echo "- Step 6 'state':'offline' => trunk not answering OPTIONS; 'online'/'unknown' is fine."

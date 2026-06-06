#!/usr/bin/env bash
# Regenerate the WebRTC/ARI TLS cert so its SAN covers the IP(s) the browser
# uses in SIP_WSS_URL. Run ON the Asterisk server, then reload Asterisk.
set -e
KEYS="${KEYS:-/etc/asterisk/keys}"
# IPs/hosts the browser may use to reach Asterisk over wss. EDIT if yours differ.
PRIMARY_IP="100.106.191.36"     # Tailscale IP in SIP_WSS_URL
LAN_IP="192.168.0.101"          # LAN IP (optional second access path)

cat > /tmp/webrtc-san.cnf <<CNF
[req]
default_bits=2048
prompt=no
default_md=sha256
distinguished_name=dn
x509_extensions=v3_req
[dn]
CN=${PRIMARY_IP}
[v3_req]
subjectAltName=@alt_names
extendedKeyUsage=serverAuth
[alt_names]
IP.1=${PRIMARY_IP}
IP.2=${LAN_IP}
DNS.1=localhost
CNF

openssl req -new -x509 -days 3650 -nodes \
  -config /tmp/webrtc-san.cnf \
  -keyout "$KEYS/asterisk.key" \
  -out    "$KEYS/asterisk.crt"
cat "$KEYS/asterisk.key" "$KEYS/asterisk.crt" > "$KEYS/asterisk.pem"
chown asterisk:asterisk "$KEYS"/asterisk.* 2>/dev/null || true
chmod 600 "$KEYS"/asterisk.key "$KEYS"/asterisk.pem 2>/dev/null || true

echo "New cert SAN:"; openssl x509 -in "$KEYS/asterisk.pem" -noout -ext subjectAltName
echo
echo "Now reload Asterisk:"
echo "  asterisk -rx 'module reload res_http_websocket.so'"
echo "  asterisk -rx 'core restart now'"
echo "Then in the agent browser, open https://${PRIMARY_IP}:8089/ws once and accept the cert."

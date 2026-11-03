#!/bin/bash
# Nightly database backup, kept for 14 days. Also keeps deploy.log from growing.
set -euo pipefail
umask 077
export PATH=/usr/local/bin:/usr/bin:/bin
ENV_FILE=/home/dev/CallCenterWebApp/.env
DIR=/home/dev/backups/db
mkdir -p "$DIR"
env_val() { grep -E "^$1=" "$ENV_FILE" | cut -d= -f2-; }

OUT="$DIR/dialer-$(date +%Y%m%d-%H%M%S).sql.gz"
MYSQL_PWD="$(env_val DB_PASSWORD)" mysqldump -h "$(env_val DB_HOST)" -u "$(env_val DB_USER)" \
  --single-transaction --routines --no-tablespaces "$(env_val DB_NAME)" | gzip > "$OUT.tmp"
gzip -t "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
find "$DIR" -name 'dialer-*.sql.gz' -mtime +14 -delete
echo "$(date '+%F %T') backup ok $OUT $(du -h "$OUT" | cut -f1)"

LOG=/home/dev/deploy.log
if [ "$(stat -c %s "$LOG" 2>/dev/null || echo 0)" -gt 5242880 ]; then
  tail -n 2000 "$LOG" > "$LOG.tmp" && cat "$LOG.tmp" > "$LOG" && rm -f "$LOG.tmp"
fi

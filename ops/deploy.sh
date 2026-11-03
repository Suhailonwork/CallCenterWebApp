#!/bin/bash
# Deploys GitHub main, run by cron every minute.
#   - builds in a separate folder, so a failed build never touches the live app
#   - restarts only when no call is live (touch ~/deploy-now to override)
#   - rolls back by itself if the site does not come back after the restart
export PATH=/usr/local/bin:/usr/bin:/bin
LIVE=/home/dev/CallCenterWebApp
BUILD=/home/dev/deploy-build
FAILED=/home/dev/.deploy-failed
log() { echo "$(date '+%F %T') $*"; }

exec 9>/tmp/callcenter-deploy.lock
flock -n 9 || exit 0

cd "$LIVE" || exit 1
git fetch -q origin main || exit 0
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0
[ "$(cat "$FAILED" 2>/dev/null)" = "$REMOTE" ] && exit 0   # already failed: wait for a new commit

# ---- build, once per commit ------------------------------------------------
if [ "$(cat "$BUILD/.built" 2>/dev/null)" != "$REMOTE" ]; then
  log "building $REMOTE"
  git worktree remove --force "$BUILD" 2>/dev/null
  rm -rf "$BUILD"
  git worktree prune
  git worktree add -q --detach "$BUILD" "$REMOTE" || exit 1
  cp .env "$BUILD/.env"
  if ! (cd "$BUILD" && npm ci --no-audit --no-fund && npm run build); then
    log "BUILD FAILED for $REMOTE - live app left untouched"
    echo "$REMOTE" > "$FAILED"
    git worktree remove --force "$BUILD"
    exit 1
  fi
  echo "$REMOTE" > "$BUILD/.built"
fi

# ---- wait until no customer is on the line ---------------------------------
if [ ! -e /home/dev/deploy-now ]; then
  env_val() { grep -E "^$1=" .env | cut -d= -f2-; }
  LIVE_CALLS=$(MYSQL_PWD="$(env_val DB_PASSWORD)" mysql -h "$(env_val DB_HOST)" -u "$(env_val DB_USER)" -N -B "$(env_val DB_NAME)" -e \
    "SELECT COUNT(*) FROM calls WHERE ended_at IS NULL AND status IN ('dialing','ringing','connected') AND created_at > NOW() - INTERVAL 2 HOUR" 2>/dev/null)
  if [ "$LIVE_CALLS" != "0" ]; then
    log "built $REMOTE, waiting: ${LIVE_CALLS:-unknown} live calls"
    exit 0
  fi
fi
rm -f /home/dev/deploy-now

# ---- swap ------------------------------------------------------------------
log "deploying $REMOTE (was $LOCAL)"
pm2 stop callcenter >/dev/null
rm -rf .next.prev node_modules.prev
mv .next .next.prev
mv node_modules node_modules.prev
git reset -q --hard "$REMOTE"
mv "$BUILD/.next" .next
mv "$BUILD/node_modules" node_modules
pm2 restart callcenter >/dev/null

healthy() {
  for _ in $(seq 1 12); do
    sleep 5
    [ "$(curl -sk -o /dev/null -w '%{http_code}' --max-time 5 https://localhost:3000/login)" = "200" ] && return 0
  done
  return 1
}

if healthy; then
  git worktree remove --force "$BUILD" 2>/dev/null
  git worktree prune
  rm -rf .next.prev node_modules.prev
  log "deployed $REMOTE"
else
  log "SITE DID NOT COME BACK on $REMOTE - rolling back to $LOCAL"
  pm2 stop callcenter >/dev/null
  git reset -q --hard "$LOCAL"
  rm -rf .next node_modules
  mv .next.prev .next
  mv node_modules.prev node_modules
  pm2 restart callcenter >/dev/null
  echo "$REMOTE" > "$FAILED"
  git worktree remove --force "$BUILD" 2>/dev/null
  git worktree prune
  log "rolled back to $LOCAL"
fi

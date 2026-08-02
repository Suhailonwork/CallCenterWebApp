# Call Center Platform — Code Health Audit

_Audit date: 2026-05-31. Scope: all API routes, lib modules, middleware, the
call path (server.mjs, ari-app.js, sipPhone, dialplan), and components._

## Summary

The codebase is well-built and internally consistent. TypeScript compiles
clean (`tsc --noEmit` passes). Auth, RBAC, the DB layer, and all CRUD routes
follow solid patterns (parameterized queries, transactions, zod validation).
The problems you're hitting are **integration/config issues** (Asterisk
endpoint naming + realtime not fully live), not broken application logic — plus
a handful of real bugs and limitations listed below.

## What is solid

- **Auth**: JWT via `jose`, bcrypt password hashing, httpOnly/sameSite cookie,
  edge middleware enforcing role-per-path. No obvious auth bypass.
- **DB access**: single pooled connection, every query parameterized
  (no SQL injection found). Multi-step writes use transactions with rollback.
- **Validation**: zod schemas on all mutating routes.
- **Dashboards/metrics/reports**: queries are correct; CSV export escapes cells.
- **Call path is internally consistent**: softphone sends `X-Gateway: gw{id}`
  → dialplan `from-webrtc` → `Stasis(callapp,outbound)` → ARI originates
  `PJSIP/<number>@gw{id}`. Status check also uses `gw{id}`. All three agree.

## Bugs & issues found

### 1. Endpoint naming depends on realtime being live (the active blocker)
The app uses `gw{id}` for the gateway endpoint everywhere. That endpoint only
exists in Asterisk once PJSIP realtime is serving the `ps_*` tables. Until the
realtime tables are populated (backfill) and `res_config_mysql` is loaded, ARI
returns 404 → "offline" and calls fail. _Fix in progress (realtime setup)._

### 2. Campaign "Edit gateways" → Save returned 500  (FIXED)
`PATCH /api/admin/campaigns/[id]` swallowed the real DB error. Hardened:
validates gateway ids first (clear 400 instead of FK 500), makes the audit-log
insert non-fatal, and now returns the actual SQL message. Re-check your server
log line `[campaign PATCH] failed:` for the original cause.

### 3. Dialer multi-agent race condition  (real bug)
`GET /api/employee/dialer/next` selects the next `called = 0` contact with no
claim/lock. Two agents on the same campaign can be handed the **same** contact
and dial it twice. Fix: atomically claim a row (e.g. `UPDATE ... SET
claimed_by=?, claimed_at=NOW() WHERE id=(SELECT ... LIMIT 1)` or a status flag)
before returning it.

### 4. "Predictive" / "Ratio" dialers are actually progressive
Both modes dial one contact at a time (dial → on hangup → dial next). There is
no over-dialing, pacing, or abandonment logic. Works fine, but it's not a true
predictive/ratio dialer — rename or implement pacing if that matters.

### 5. ARI fallback gap
In `ari-app.js`, the default trunk falls back to `TRUNK_ENDPOINT` (default
`dinstar`) **only when the `X-Gateway` header is absent** — not when the named
endpoint is invalid. During the static→realtime transition, a header pointing
at a not-yet-existing `gw{id}` fails instead of falling back.

### 6. Shared SIP password
Every employee is created with `sip_password = 'webrtcpass'` (hardcoded in
`/api/admin/users`). All agents share one SIP secret. Generate a per-agent
password at creation if you need real endpoint security.

### 7. JWT secret default
`JWT_SECRET` falls back to `'dev-insecure-secret-change-me'`. Ensure it is set
in `.env` for production, or all tokens are forgeable.

## Asterisk config hygiene (server side)

- **`http.conf`** has duplicated `[general]` keys and two different
  `tlscertfile` values (`server.pem` vs `asterisk.pem`). Ambiguous which cert
  serves `wss:8089` — directly relevant to the agent "Connecting…" issue.
- **`extensions.d/carrier-gw216x.conf`** are leftover experiments with repeated
  `[from-internal]` contexts and example dialplans (gw2162/gw2163…). Not used by
  the Stasis flow; remove to avoid context confusion.

## Could not verify from here (needs the running system)
Actual DB rows, live Asterisk endpoints/state, ARI reachability, and the
browser WebRTC registration. Use `diagnose-asterisk.sh` on the Asterisk box.

## Suggested priority
1. Finish realtime so `6001` + `gw{id}` exist (unblocks calls + registration).
2. Fix the dialer claim race (#3) before running multi-agent campaigns.
3. Clean up `http.conf` cert duplication (#8) to fix agent registration.
4. Address shared SIP password (#6) and JWT secret (#7) before production.

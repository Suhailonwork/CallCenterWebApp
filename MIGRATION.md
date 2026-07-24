# Lists Layer Migration (VICIdial-style)

Leads now belong to a **LIST**; a list belongs to exactly **one campaign**;
a campaign never owns leads directly. Campaign = rules (dial statuses,
recycle, gateways, agents); List = data container with an ON/OFF switch.

## Run order (on the DB server / with the Tailscale `dev` host reachable)

```bash
npm run db:migrate:lists     # 1. schema + backfill (idempotent, additive)
npm run db:seed:templates    # 2. seed Default List / BX Process / PI Process templates
```

Then restart the app (`npm run dev` / `npm run start`) so the engine and
routes pick up the new claim logic.

## What db:migrate:lists does

1. Creates the `lists` table (name, campaign_id FK, `active` Y/N, per-list
   `template_id` → data_tables, description, timestamps).
2. `csv_data` gains: `list_id` FK, `call_count`, `last_call_at`,
   `recycle_attempts`; `call_status` becomes the lead **status**
   (`NOT NULL DEFAULT 'NEW'`, old NULLs backfilled to `'NEW'`).
   The existing `called` flag now means **called_since_last_reset**.
3. `campaigns` gains: `dial_statuses` JSON (default
   `["NEW","no_answer","busy"]` — this app's NEW/NA/B) and `recycle_rules`
   JSON (default: retry `no_answer` after 60 min ×3, `busy` after 30 min ×3).
4. For every campaign without a list: creates **"Default List"**
   (`active='Y'`, template = the campaign's own `data_table_id`) and
   re-homes all of the campaign's leads into it. Zero data loss; the app
   behaves identically right after the migration.

Re-running is a no-op. **Rollback**: `npm run db:rollback:lists` (drops the
new columns/table, reverts `call_status` to nullable with `'NEW'` → NULL) —
only roll back together with checking out pre-lists code.

## New dial eligibility (predictive engine + /api/employee/dialer/next)

A lead is claimable when **all** of:

- its list is `active='Y'` (toggling OFF stops new claims on the next tick),
- its claim is free or expired (unchanged `claimed_at` mechanics), and
- **either**
  - **normal**: `called=0` **and** `call_status` ∈ campaign `dial_statuses`, or
  - **recycle**: `call_status` matches a recycle rule **and**
    `last_call_at` ≤ now − `delay_min` **and** `recycle_attempts` <
    `max_attempts` (ignores `called` — VICIdial behavior).

Single source of truth: `src/lib/dialEligibility.js` (shared CJS module).
On every dial the engine stamps `called=1`, `call_count+1`,
`last_call_at=NOW()`; failed attempts get `call_status` `no_answer`/`failed`
so recycle rules can pick them up. `recycle_attempts` resets on RESET and on
status change. Statuses **not** in `dial_statuses` (connected, wrong_number,
…) are never re-dialed.

## Data Templates seeded (db:seed:templates)

`Default List` (25 cols), `BX Process` (29), `PI Process` (28) — exact
names/order from Updated.xlsx; **"Mobile NO"** is the dialed number in all
three. Idempotent: skipped when a template with the same name exists.
CSV header matching is trim + collapse-spaces + case-insensitive.

## Day-to-day

- **Upload CSV** (Campaigns page) now asks for a target list (existing or
  create inline: name + template) and a duplicate check: none / this list /
  all lists of the campaign. Old `/campaigns/:id/contacts` endpoints still
  work — they land in the campaign's Default List.
- **Admin → Lists**: per-list lead totals, per-status counts, last call
  date; Modify (rename / move campaign — re-homes leads / template /
  ON‑OFF), RESET (confirm shows how many become dialable; statuses stay),
  Delete (empty lists only).
- **Campaigns → Dial rules**: multi-select the claimable statuses and edit
  recycle rules (status / delay minutes / max attempts).

## Behavior change to know about

Before: an unanswered predictive attempt left the lead untouched, so it was
silently re-dialed every claim-timeout forever. Now every dial marks the
lead; unanswered leads come back **only** via a recycle rule (bounded) or a
list RESET. Campaign progress bars count `called` (since last reset), so a
RESET moves a campaign's progress back — that is by design.

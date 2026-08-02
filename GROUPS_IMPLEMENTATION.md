# Group-Based Campaign Management — Implementation Record

Date: 2026-06-12. Additive feature; no existing table, route, or field was renamed or removed.

## 1. Database migration plan

**Run on the server:** `npm run db:migrate:groups` (executes `db/migrate-groups.mjs`).

- Creates `groups`, `group_tl`, `group_agents` (`CREATE TABLE IF NOT EXISTS`, see
  `db/migrations/001-groups.sql`).
- Adds `campaigns.group_id INT NULL` + FK (`ON DELETE SET NULL`) + index, only if the
  column does not exist yet (checked via `information_schema`) — the script is idempotent.
- Existing campaigns keep `group_id = NULL` = "ungrouped / legacy"; they behave exactly
  as before (admin manages them, agents reach them through `campaign_assignments`).
- `db/schema.sql` was updated identically so a fresh install matches.
- ⚠ Never run `npm run db:migrate` on the live DB — that script (pre-existing) drops every
  table. Only `db:migrate:groups` is safe in production.
- ⚠ Pre-existing schema drift noted (not changed here): the live DB has
  `campaigns.recording_enabled` and a `pending_recordings` table that `db/schema.sql`
  does not declare. Fresh installs from schema.sql were already broken before this work.

`groups` is a reserved word in MySQL 8 — every query backticks it; all such queries live in
new files (`src/lib/groups.ts`, groups routes).

## 2. Data model

| Table | Purpose |
|---|---|
| `groups` | id, unique name, description, created_by |
| `group_tl` | (group_id, tl_id) unique — a group can have several TLs |
| `group_agents` | (group_id, agent_id) unique — agents in the group |
| `campaigns.group_id` | nullable owner; `SET NULL` on group delete (campaigns survive) |

`teams` was deliberately **not** reused: it is single-TL, drives the manager reporting line
and break approvals; changing its semantics risked existing flows.

## 3. RBAC matrix (enforced at API level, not just UI)

| Actor | Campaigns | Leads/CSV | Customer history / notes / dispo | Recordings | Agents |
|---|---|---|---|---|---|
| Admin | all | all | all | all | all |
| TL | only own groups (`tlOwnsCampaign`) | upload only into own-group campaigns | only calls of own-group campaigns | only own-group campaign calls | own-group agents (+ legacy reports_to) |
| Agent | assigned ∪ own-group, active only | dialer claims blocked outside that set (403) | own calls | own calls only | — |
| Manager | unchanged | unchanged | unchanged | unchanged | unchanged |

Helpers in `src/lib/groups.ts`: `groupIdsForTL/Agent`, `tlOwnsGroup`, `tlOwnsCampaign`,
`agentCanAccessCampaign`, `agentsInTLGroups`, `syncGroupMembers`, `listGroups`.

## 4. API changes

**New routes (no existing route touched by these):**
- `GET/POST /api/admin/groups`, `GET/PATCH/DELETE /api/admin/groups/[id]`
- `GET /api/tl/groups` — TL's groups + their agents
- `GET/POST /api/tl/campaigns`, `PATCH /api/tl/campaigns/[id]`
- `POST /api/tl/campaigns/[id]/contacts` (CSV), `GET /api/tl/campaigns/[id]/details`
- `GET /api/tl/customers/[phone]` — group-scoped history

**Extended existing routes (backward compatible — old request bodies still valid):**
- `GET/POST /api/admin/campaigns`, `PATCH /api/admin/campaigns/[id]`: optional
  `group_id` in/out (validated; nullable).
- `GET /api/employee/campaigns`: now assigned ∪ group campaigns (was assigned only).
- `GET /api/employee/dialer/next`: 403 unless agent may work the campaign
  (**previously had no campaign-level check at all**).
- `POST /api/employee/calls`: same check when `campaignId` is supplied.
- `/api/campaigns/[id]/assignments`: TL allowed, scoped to own-group agents and
  own-group campaigns; admin/manager behavior unchanged.
- `GET /api/recordings/[filename]`: TL + employee allowed with ownership checks
  (was admin-only).
- `GET /api/tl/overview`: merges group agents into the legacy reports_to list (deduped).
- `GET /api/admin/gateways` (+`/status`): TL granted read-only access (needed for the
  TL campaign form); writes remain admin-only.

## 5. Frontend changes

- New: `GroupManager.tsx` + `/admin/groups` page; "Groups" link in admin nav.
- `CampaignManager.tsx`: optional props `apiBase`/`consoleBase`/`requireGroup`
  (defaults = previous admin behavior); group dropdown in create form; group badge.
- Campaign detail and customer history bodies moved verbatim into shared
  `CampaignDetail.tsx` / `CustomerHistory.tsx`; admin pages are now thin wrappers
  passing the same URLs as before. New TL pages `/tl/campaigns`, `/tl/campaigns/[id]`,
  `/tl/customers/[phone]`; "Campaigns" link in TL nav.
- `Dialer.tsx`: "Select Campaign" dropdown when the agent has >1 allowed campaign
  (disabled mid-call / while auto-dialer runs); single-campaign flow unchanged
  (first campaign still auto-selected).

## 6. Rollback strategy

1. App: revert the git commit and redeploy — the schema additions are inert without the
   code (no existing query references the new tables/column).
2. Schema (optional, only if a full clean-up is wanted):
   ```sql
   ALTER TABLE campaigns DROP FOREIGN KEY fk_campaigns_group,
                         DROP INDEX idx_campaigns_group,
                         DROP COLUMN group_id;
   DROP TABLE IF EXISTS group_agents, group_tl, `groups`;
   ```
   No existing data is touched by either step.

## 7. Risk assessment

- **Low:** all schema changes additive; migration verified idempotent locally; existing
  campaigns confirmed intact (`group_id` NULL).
- **Behavioral deltas to be aware of:**
  - Agents previously able to claim leads from *any* campaign id can no longer do so —
    this is the requested enforcement; legitimate flows only use ids from
    `/api/employee/campaigns`, which were always allowed.
  - TLs can now see gateway names/IPs (read-only) and recordings/notes of their groups'
    campaigns — intended by the requirements.
  - An agent in a group sees every active campaign of that group in the dropdown, in
    addition to direct assignments.
- **Verification done:** `tsc --noEmit` clean, `next build` clean, migration run twice
  (idempotent), existing row counts unchanged.

# Predictive Dialer — architecture & operations

VICIdial-style predictive dialing on the existing Next.js + MySQL + Asterisk
stack. The UI, the database and the module layout are unchanged; the backend
workflow behind them was rebuilt.

Apply with:

```bash
npm run db:migrate:vicidial   # additive + idempotent, safe on a live database
```

---

## 1. The lead lifecycle

Every contact lives in `csv_data` and moves through one state machine. This is
defined once, in [`src/lib/leadStatus.js`](src/lib/leadStatus.js), and every
component reads it from there.

```
NEW ──▶ QUEUED ──▶ DIALING ──▶ RINGING ──┬─▶ CONNECTED ──▶ (wrap-up)
                                          ├─▶ BUSY
                                          ├─▶ NO_ANSWER
                                          ├─▶ FAILED
                                          ├─▶ VOICEMAIL
                                          └─▶ CANCELLED
                                                  │
                        recycle rule allows it ───┤──▶ next_retry_at set
                                                  │        (redial queue)
                        attempts exhausted    ────┴──▶ COMPLETED
```

Extra resting statuses: `CALLBACK` (a promised call, always dialable),
`WRONG_NUMBER` and `DNC` (terminal).

**Non-redialable outcomes.** Only `DNC` is hard-banned — the customer asked not
to be called, so no campaign configuration may override it. `parseDialStatuses`
strips it and `parseRecycleRules` drops any rule naming it.

Every other status, including ones that are usually final (`CONNECTED`,
`WRONG_NUMBER`, `COMPLETED`, `CANCELLED`), may carry a recycle rule. Writing one
is an explicit instruction to redial that status, and an already-called lead
becomes eligible as soon as the rule's delay has elapsed since `last_call_at` —
no list RESET, and `next_retry_at` does not need to be pre-populated. That is
what makes moving a list between campaigns work: the destination campaign's
rules govern leads that were called under the source campaign's.

**The invariant:** a lead never stays `NEW` once it has been dialed. The dial
stamp and the status write happen in the same UPDATE, so there is no window
where `called = 1` and the status still reads `NEW`. The migration also
repaired any leads already stranded that way.

Statuses are stored UPPERCASE. MySQL's collation here is case-insensitive, so
campaigns still holding the old lowercase spellings (`no_answer`) keep matching
without reconfiguration.

### The eight columns, and who writes them

| Column | Written at | By |
|---|---|---|
| `call_status` | every transition | `leadWriter` |
| `called` | dial start | `markDialing` |
| `call_count` | dial start (once per attempt, not per failover hop) | `markDialing` |
| `last_call_at` | dial start | `markDialing` |
| `recycle_attempts` | +1 on a recycle-branch claim, reset when the status changes | `markDialing` / `finalizeLead` |
| `next_retry_at` | attempt end | `finalizeLead` |
| `assigned_to` | claim / release | `reserveLead` / `finalizeLead` |
| `claimed_at` | claim, refreshed while live, cleared on release | `reserveLead` / `touchClaim` |

[`src/lib/leadWriter.js`](src/lib/leadWriter.js) is the **only** module that
writes these. The engine, the ARI app, the manual dialer API and the wrap-up API
all call into it, so the columns cannot drift apart.

---

## 2. Contact locking

A claim is `assigned_to` + `claimed_at`. The claim query
([`src/lib/dialEligibility.js`](src/lib/dialEligibility.js)) uses
`FOR UPDATE SKIP LOCKED`, so concurrent workers step over each other's rows
instead of serialising.

A lead is claimable when the claim is absent, **or** the claim has expired *and*
the lead is not mid-call:

```sql
claimed_at IS NULL
OR ( claimed_at < NOW() - INTERVAL :claimTimeout SECOND
     AND call_status NOT IN ('QUEUED','DIALING','RINGING','CONNECTED') )
```

A live call always holds a fresh claim, so a customer who is on the phone right
now can never be selected a second time — even on a campaign that recycles
`CONNECTED`, because the mid-call guard keys off the claim, not the status.

Crashes are handled by `recoverStaleLeads`, which runs at startup and every 15s:

- `QUEUED` past the claim timeout → rolled back to `pre_dial_status`
- `DIALING`/`RINGING` past the ring timeout → `FAILED` + retry per the rules
- `CONNECTED` past the on-call timeout → `CANCELLED` + retry per the rules

---

## 3. The predictive engine

[`predictive-engine.js`](predictive-engine.js), one tick per second:

1. **Find READY agents** per campaign (`agentRegistry`).
2. **Work out the ratio** — `campaigns.dial_ratio`, throttled to 1.0 while the
   abandon rate is over `campaigns.max_abandon_pct`.
3. **Turn that into capacity** — `ratio × agents − live lines`, capped by the
   free gateway channels.
4. **Claim that many leads** in one transaction, writing them to `QUEUED`.
5. **Dial them** through the gateway pool.
6. **Update lead + call history immediately** at every step.

Nothing is pre-bound to an agent. The agent is chosen at the moment the customer
answers — that is what makes over-dialing safe. `dial_ratio = 1.00` (the
default) opens exactly one line per ready agent, so there are no abandons at
all; above 1 the engine over-dials and backs itself off automatically.

Also in the loop: per-phone in-flight locks, a per-number cooldown, callback
injection, agent-seat recovery and stale-attempt recovery.

### Campaign controls (Campaigns → Dial rules)

| Setting | Column | Meaning |
|---|---|---|
| Dial statuses | `dial_statuses` | which lead statuses the dialer may claim |
| Recycle rules | `recycle_rules` | `[{status, delay_min, max_attempts}]` |
| Dial ratio | `dial_ratio` | lines per READY agent |
| Max attempts | `retry_count` | total attempts per lead; 0 = unlimited |
| Ring timeout | `dial_timeout_sec` | how long the customer's phone may ring |
| Breather | `wrapup_seconds` | pause after a call before a new line is opened |
| Max abandon % | `max_abandon_pct` | over this, the ratio drops to 1.0 |
| Lead order | `lead_order` | oldest / newest / least-recently-called / random |
| Callbacks | `callbacks_enabled` | feed due callbacks into the queue |
| Calling window | `calling_start` / `calling_end` | may wrap past midnight |

Saving kicks the engine, so changes take effect in milliseconds.

---

## 4. Retries and the redial queue

At the end of every attempt `finalizeLead` applies the campaign's rules and
either schedules the redial or closes the lead:

- find the recycle rule for the outcome status
- allowed while `recycle_attempts < rule.max_attempts` **and**
  `call_count < retry_count` (when `retry_count > 0`)
- if allowed → `next_retry_at = NOW() + rule.delay_min`
- if the campaign's attempt cap is hit → `COMPLETED` + `completed_at`

`recycle_attempts` resets when the status *changes*, so each status gets its own
retry budget — the same rule the claim query enforces, so "retry scheduled" in
the log always means the lead really does come back.

---

## 5. Gateways

[`src/lib/gatewayPool.js`](src/lib/gatewayPool.js) handles selection:

- **Balancing** — highest `priority` first, then least-loaded by channel usage.
- **Capacity** — `gsm_gateways.channels` is a hard cap on concurrent calls
  (0 = uncapped).
- **Failover** — an originate error moves the same contact to the next gateway,
  up to three hops. This costs one attempt, not three.
- **Health** — ARI endpoint state is polled every 20s. Only an *explicit*
  `offline` counts as down; GSM gateways that ignore SIP OPTIONS stay usable.
- **Cooldown** — after 3 consecutive failures a gateway leaves the rotation for
  60s. A successful call clears the streak.

---

## 6. Agent states

[`src/lib/agentRegistry.js`](src/lib/agentRegistry.js):

```
LOGOUT ──login──▶ PAUSE ──go available──▶ READY ──call assigned──▶ INCALL
                    ▲                       ▲                        │
                    └──── take a break ─────┴──── WRAPUP ◀── call ends
                                         disposition saved
```

Only `READY` agents are dialed for. **A finished call lands the agent in
`WRAPUP`, never straight back in the ready pool** — this closes a real bug where
the dialer could drop a new customer on an agent whose wrap-up form was still
open. They return to `READY` when the wrap-up is saved, or after
`dialer_wrapup_timeout_sec`.

The Socket.IO payload keeps its original `state` / `available` fields, so the
existing Live Agents widget renders unchanged; `agentState` carries the
canonical value for the new dashboard.

---

## 7. Call history

`calls` is now a true call-history table: **one row per attempt**, opened the
moment the attempt goes out (`status = 'dialing'`) and closed at hangup. Rows
are created for attempts that never reach an agent too (`employee_id` is NULL).

Recorded: contact, campaign, list, gateway, agent, `started_at`, `answered_at`,
`ended_at`, `ring_seconds`, `duration_seconds` (talk time), `hangup_cause`,
`disposition`, `lead_status`, `dial_source`, `attempt_no`, `recording_url`.

The wrap-up **updates** the attempt's row rather than inserting a second one, so
an attempt is never counted twice.

---

## 8. Callbacks

A wrap-up with a follow-up writes `scheduled_calls` with the lead, campaign and
list. When it comes due the engine moves the lead to `CALLBACK` with
`priority = 100` and clears its retry timer, so it dials next. `CALLBACK` is
dialable regardless of `dial_statuses` — an agent promised the customer this
call.

An **agent** callback keeps `assigned_to` set and the engine hands the answered
call back to that agent when they are READY; a **campaign** callback goes to
whoever is free.

---

## 9. Logging

Every lead leaves a trail in the process log and in `dialer_log`:

```
[DIALER] event=dial_started lead=412 campaign=2 list=4 gw=3 call=91 status=QUEUED->DIALING phone=98… attempt=2
```

Events: `selected · reserved · dial_started · ringing · answered · connected ·
abandoned · failed · retry_scheduled · retry_attempt · disposition · completed ·
released · recovered · callback_queued · gateway_up · gateway_down`.

Log writes are fire-and-forget — a logging failure can never break a call.

---

## 10. Reporting

| Endpoint | Purpose |
|---|---|
| `GET /api/admin/dialer/live` | live dashboard (calls, agents, gateways, queues) |
| `GET /api/admin/reports/dialer?type=campaign` | attempts, connect %, abandon %, talk time |
| `…?type=agent` | calls handled, connect %, talk time |
| `…?type=gateway` | attempts, answer %, failures |
| `…?type=contact` | per-lead attempt history + current status |
| `…?type=hourly` | attempts / connects / abandons per hour |
| `…?type=status` | lead-status distribution per list |
| `GET /api/admin/leads/:id` | one contact's full story: state, attempts, events |

All report types accept `from`, `to`, `campaignId` and `format=csv`.
The live dashboard is **Admin → Live Dialer**.

---

## 11. Answering-machine detection (optional)

Off by default. To enable:

1. Add the `[predictive-amd]` context from
   [`asterisk-config/extensions.conf`](asterisk-config/extensions.conf) to the
   Asterisk box and reload the dialplan.
2. `UPDATE settings SET setting_value = '1' WHERE setting_key = 'dialer_amd_enabled';`

The engine then originates answered calls through that context, Asterisk runs
`AMD()`, and a `MACHINE` result is hung up and recorded as `VOICEMAIL` instead
of burning an agent. With the setting off, every answer is treated as a human —
detection degrades to off rather than guessing.

---

## 12. Global settings (`settings` table)

| Key | Default | Meaning |
|---|---|---|
| `dialer_enabled` | 1 | master switch for originating |
| `dialer_tick_ms` | 1000 | pacing loop interval |
| `predictive_ratio` | 1 | fallback ratio when a campaign has none |
| `phone_cooldown_seconds` | 60 | minimum gap between calls to one number |
| `dialer_claim_timeout_sec` | 120 | an unfinished reservation is re-offered |
| `dialer_ringing_timeout_sec` | 90 | a stuck DIALING/RINGING lead is recovered |
| `dialer_oncall_timeout_sec` | 1800 | a stuck CONNECTED lead/agent is recovered |
| `dialer_wrapup_timeout_sec` | 900 | an abandoned wrap-up releases the seat |
| `dialer_gateway_health_sec` | 20 | ARI endpoint health poll |
| `dialer_gateway_fail_threshold` | 3 | failures before a gateway cools down |
| `dialer_gateway_cooldown_sec` | 60 | how long it stays out |
| `dialer_max_abandon_pct` | 3 | fallback abandon cap |
| `dialer_callback_lookahead_min` | 5 | how early a callback is queued |
| `dialer_amd_enabled` | 0 | answering-machine detection |

All are re-read every 15s — no restart needed.

# Predictive Dialer — architecture & operations

VICIdial-style predictive dialing on the existing Next.js + MySQL + Asterisk
stack. The UI, the database and the module layout are unchanged; the backend
workflow behind them was rebuilt.

Apply with:

```bash
npm run db:migrate:vicidial       # additive + idempotent, safe on a live database
npm run db:migrate:dispositions   # disposition-driven dialing rules (§4a)
```

---

## 1. The lead lifecycle

Every contact lives in `csv_data` and moves through one state machine. This is
defined once, in [`src/lib/leadStatus.js`](src/lib/leadStatus.js), and every
component reads it from there.

Which of these steps the server performs at all depends on the campaign's
**dialer mode** — see §3, which is the contract the rest of this document
assumes.

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

## 3. Dialer modes — the engine's contract

`campaigns.dialer_type` decides who dials and how the pace is chosen. It is not
a label: [`src/lib/dialerModes.js`](src/lib/dialerModes.js) is the one
definition, and the UI, the API and the engine all read it.

| Mode | Who dials | Lines opened | Pacing settings it owns |
|---|---|---|---|
| **manual** | the agent | one, when they press Call | none |
| **inbound** | the customer | none | none |
| **ratio** | the server | **fixed**: `dial_ratio` × ready agents | `dial_ratio` |
| **predictive** | the server | **computed** every tick (§3.1) | `dial_ratio` (ceiling), `max_abandon_pct`, `wrapup_seconds` |

**Ratio dialing is not predictive dialing.** A ratio campaign opens exactly the
number of lines it was configured to open and consults no statistic; only a
predictive campaign measures its queue and changes its own pace. They are
separate functions, not one function with a flag.

**The mode is enforced, not assumed.** Four independent gates, so no path can
dial for a campaign that did not ask for it:

1. the tick skips a campaign that is not engine-driven, *and* moves its agents
   out of the pacing pool (see below);
2. `claimLeads` refuses to reserve leads for one;
3. `dialLead` refuses to originate and logs it as a bug if it is ever reached;
4. `agent-available` / `agent-state` on the socket refuse to put an agent into
   READY on a manual or inbound campaign — a hand-crafted socket message cannot
   turn a manual campaign into a dialable one.

**Changing the mode takes effect immediately.** Saving kicks the engine, which
drops its campaign cache; on the next tick a campaign that is no longer
engine-driven has its READY agents moved to PAUSE and their browsers told why
(`dialer-mode-changed`), so nobody sits waiting for a call that will never
come. Agents already on a call are left alone — a mode change never cuts off a
live conversation. Pacing columns a mode does not own are refused by the API
with an explanatory error and are not shown in the UI.

### 3.1 Predictive pacing (predictive mode only)

The question a predictive dialer answers is not "how many agents are free" but
"how many will be free when a call placed now is answered". Every second, in
[`src/lib/pacing.js`](src/lib/pacing.js):

```
expectedFree = READY agents + agents whose call ends within one ring cycle
lines        = expectedFree ÷ measured answer rate
lines        = governor(lines)                 ← abandon budget
target       = min(lines, READY × dial_ratio)  ← the operator's ceiling
slots        = target − lines already live     ← then capped by gateway channels
```

Everything on the right is measured, not configured, over a 15-minute rolling
window per campaign: **answer rate** (answered ÷ attempts), **ring time** (dial
→ answer, the horizon the forecast aims at) and **handle time** (talk + the
wrap-up breather, which is how it knows who is about to free up).

The **abandon governor** is proportional rather than a switch: inside 75% of
`max_abandon_pct` the forecast is used as measured, from there to the limit it
is damped linearly toward progressive, and over the limit the campaign dials
exactly one line per ready agent until it recovers. A campaign therefore slows
down *before* it breaks its target instead of oscillating around it.

Two floors keep it safe: an idle agent always gets a call whatever the
statistics say, and a campaign with fewer than 20 attempts on record paces
progressively rather than forecasting from noise.

`dial_ratio` is a **ceiling** here, not the setting — the default of 1.00 means
"never open more than one line per ready agent", so an existing campaign keeps
behaving exactly as it did until someone raises it.

### 3.2 Ratio pacing (ratio mode only)

`dial_ratio` lines per READY agent, every tick, blind to the answer rate and
the handle time. The only thing that can hold it back is the global abandon
cutoff (`dialer_max_abandon_pct`), which is a compliance stop rather than
pacing: over the limit the campaign drops to one line per agent, and it never
raises or computes anything.

### 3.3 The rest of the loop

Nothing is pre-bound to an agent. The agent is chosen at the moment the
customer answers — that is what makes over-dialing safe. Also in the loop:
per-phone in-flight locks, a per-number cooldown, callback injection,
agent-seat recovery and stale-attempt recovery.

### Campaign controls (Campaigns → Dial rules)

| Setting | Column | Applies to | Meaning |
|---|---|---|---|
| Dial statuses | `dial_statuses` | all | which lead statuses the dialer may claim |
| Recycle rules | `recycle_rules` | all | `[{status, delay_min, max_attempts}]` |
| Disposition rules | `disposition_rules` | all | overrides for §4a, keyed by code; NULL = defaults |
| Max attempts | `retry_count` | all | total attempts per lead; 0 = unlimited |
| Ring timeout | `dial_timeout_sec` | all | how long the customer's phone may ring |
| Lead order | `lead_order` | all | oldest / newest / least-recently-called / random |
| Callbacks | `callbacks_enabled` | all | feed due callbacks into the queue |
| Calling window | `calling_start` / `calling_end` | all | may wrap past midnight |
| Max lines per agent | `dial_ratio` | predictive | the **ceiling** the forecast may not exceed |
| Max abandon % | `max_abandon_pct` | predictive | where the governor damps and then stops over-dialing |
| Breather | `wrapup_seconds` | predictive | pause after a call before a new line is opened |
| Lines per ready agent | `dial_ratio` | ratio | the **fixed** number of lines, no forecast |

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

## 4a. Disposition rules — what the agent's answer does to the lead

A wrap-up produces two different things, and they are not the same thing:

| | who picks it | what it means |
|---|---|---|
| **Call status** | the agent, in **manual** mode only | what the *line* did — connected, no answer, busy |
| **Disposition reason** | the agent, in **every** mode | what the *conversation* meant — PTP, PAID, Wrong Number |

In predictive and ratio mode the customer is already on the line when the
screen pops, so there is no line result left to judge: the wrap-up hides Call
Status and asks only for the disposition and the notes. The status is derived
from the disposition server-side, so every mode writes the same columns.

[`src/lib/dispositionRules.js`](src/lib/dispositionRules.js) is the one
definition of the catalogue and of the rule each entry produces — the Dialer's
dropdowns, the wrap-up API and the claim query all read it, so the agent is
shown the rule that actually runs.

Each rule is `{status, action, delay_min, max_attempts, requires_followup}`:

| Action | What happens next |
|---|---|
| `retry` | back on the redial queue after `delay_min`, up to `max_attempts`. No delay of its own = fall through to the campaign's recycle rules |
| `callback` | rests on `CALLBACK` and returns at the time the agent booked; a follow-up is required and the attempt cap does not apply — the agent promised this call |
| `skip` | no retry is scheduled; the lead rests on its status and returns only if the campaign's own rules cover it |
| `close` | terminal status, and the claim query refuses it from then on whatever the campaign dials |
| `dnc` | hard stop; nothing may override it |

**Reasons override codes.** The rule keys on the *reason*, not just the code:
"Number busy" rests on `BUSY` and retries in 30 minutes while the rest of `TNC`
rests on `NO_ANSWER`; `FRAUD-Fraud Case` closes the lead while the rest of
`SKIP` only parks it.

**Eligibility follows the rule too.** The claim query
([`dialEligibility.js`](src/lib/dialEligibility.js)) gained two things:

- a gate — `last_disposition` naming a closing rule is never offered again,
  even on a campaign that recycles the status it rests on;
- a branch — a lead comes back on its *disposition's* timer even when the
  status it rests on has no recycle rule (a broken promise resting on
  `CONNECTED`, say).

Both use the same numbers `planNextAttempt` scheduled with, so the planner and
the claim query cannot disagree. A list **RESET** clears `last_disposition`
along with the other counters, so a reset really does revive every lead.

**Per campaign.** `campaigns.disposition_rules` (Campaigns → Dial rules →
Disposition rules) overrides any part of the catalogue; what a campaign leaves
out keeps the default, and `NULL` means "all defaults". A campaign can make
`WN` retryable or give `PTP` a different fallback delay without touching code.

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
`disposition`, `disposition_reason`, `lead_status`, `dial_source`, `attempt_no`,
`recording_url`.

`disposition_reason` is stored next to the code because the code alone cannot
explain a decision — "Number busy" and "Switch off" are both `TNC` but retry on
different timers, and this column says which rule ran.

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

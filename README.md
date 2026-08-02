# Call Center Platform

A call center management system built with **Next.js 14 + TypeScript + MySQL**,
reusing the working Asterisk + Dinstar gateway for real calls.

All four build phases are complete — Foundation & Auth, the Employee Dialer,
the Admin / Manager / Team Lead consoles, Campaigns & Reports, and the
real-time layer.

---

## What's included

- **Foundation** — Next.js 14 (App Router) + TypeScript, Tailwind CSS, MySQL
  schema with migrations and demo seed data.
- **Authentication & RBAC** — JWT (httpOnly cookie), bcrypt password hashing,
  login/logout, and route protection for all four roles
  (Admin, Manager, Team Lead, Employee).
- **Employee Dialer** — a real WebRTC softphone:
  - Manual dialer (type a number, dial pad, click-to-call)
  - Auto dialer (pulls the next contact from a campaign, FIFO)
  - Live call screen (status, duration, call script)
  - Post-call wrap-up (disposition, notes, tags, schedule a follow-up)
  - Calls placed through the Asterisk + Dinstar trunk you already built
- **Employee Dashboard** — today's KPIs, a 7-day calls chart, recent calls,
  and scheduled follow-ups.

- **Admin console** — system KPIs, user & team management, campaigns with
  CSV contact upload, call reports with CSV export, system settings, audit log.
- **Manager & Team Lead consoles** — team performance dashboards and
  break-request approvals scoped to their own people.
- **Break management** — employees request breaks; TLs and managers approve.
- **Real-time layer** — a Socket.io server pushes live agent presence, call
  status and performance/break updates to every console as they happen.

---

> **Predictive dialing** — the outbound engine follows the VICIdial workflow
> (lead lifecycle, contact locking, ratio pacing, recycle rules, redial queue,
> gateway balancing and failover, agent states, callbacks). Its architecture,
> settings and operations live in **[DIALER.md](DIALER.md)**. Apply it to an
> existing database with `npm run db:migrate:vicidial`.

---

## Prerequisites

- **Node.js 20+**
- **MySQL 8** (running and reachable)
- The **Asterisk server** (`192.168.0.101`) from the browser-phone project,
  reachable from the machine that runs this app.

---

## Setup

### 1. Install dependencies

```bash
cd callcenter-platform
npm install
```

### 2. Create the database user

In MySQL (as root):

```sql
CREATE DATABASE IF NOT EXISTS callcenter CHARACTER SET utf8mb4;
CREATE USER 'ccuser'@'%' IDENTIFIED BY 'ccpassword';
GRANT ALL PRIVILEGES ON callcenter.* TO 'ccuser'@'%';
FLUSH PRIVILEGES;
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — set the MySQL credentials, a long random `JWT_SECRET`, and the
Asterisk WebSocket URL (`SIP_WSS_URL`). Defaults already point at
`192.168.0.101`.

### 4. Create the schema and load demo data

```bash
npm run db:migrate   # creates all tables (drops existing ones)
npm run db:seed      # inserts demo users, a campaign and sample calls
```

### 5. Run the app

```bash
npm run dev
```

Open **http://localhost:3000**. For production: `npm run build`, then `npm start`.

> The app runs on a custom Node server (`server.mjs`) that hosts Next.js and
> the Socket.io real-time layer in one process. Re-run `npm install` after
> pulling new code so the Socket.io packages are present.
>
> Use `localhost` — the WebRTC microphone needs a secure context, and
> `localhost` counts as secure. If you open the app by IP instead, the browser
> will block the microphone unless the app is served over HTTPS.

---

## Demo accounts

All demo accounts use the password **`Password123!`**

| Role       | Email                                  |
|------------|----------------------------------------|
| Admin      | `admin@cc.test`                        |
| Manager    | `manager1@cc.test`, `manager2@cc.test` |
| Team Lead  | `tl1@cc.test`, `tl2@cc.test`, `tl3@cc.test` |
| Employee   | `emp1@cc.test` … `emp6@cc.test`        |

`emp1@cc.test` is seeded with sample calls so its dashboard shows data
immediately. Employees `emp1`–`emp6` map to SIP extensions `6001`–`6006`.

---

## Asterisk setup (for real calls)

The dialer registers each employee as a SIP/WebRTC endpoint on your existing
Asterisk server. You already have endpoint `6001` and the `from-webrtc` →
Dinstar routing working from the browser phone.

To add the other agents (`6002`–`6006`):

1. Copy [`asterisk/pjsip-agents.conf`](asterisk/pjsip-agents.conf) — it contains
   endpoints `6001`–`6006`.
2. Follow the instructions in the comment header of that file (append it to
   `/etc/asterisk/pjsip.conf`, removing your old single `[6001]` block).
3. Apply: `sudo asterisk -rx "pjsip reload"`
4. Verify: `sudo asterisk -rx "pjsip show endpoints"` — `6001`–`6006` listed.

No dialplan change is needed — the `from-webrtc` context already routes agent
calls through the Dinstar trunk (and through ports 2/3/5).

Before first use, the browser must trust the Asterisk WSS certificate — open
`https://192.168.0.101:8089/` once and accept the warning (same step as the
browser phone).

---

## How the dialer works

1. Employee logs in and opens **Dialer**.
2. The page fetches the employee's SIP credentials and registers to Asterisk
   over WebRTC. The badge turns green ("Phone registered").
3. **Manual mode** — type a number (or use the dial pad) and press **Call**.
   **Auto mode** — pick a campaign, press **Load next contact**, then **Call**.
4. The live panel shows call status, a duration timer, and the call script.
5. When the call ends, the **wrap-up** dialog appears — choose a disposition,
   write notes/tags, optionally schedule a follow-up, and save.
6. In auto mode, saving immediately loads the next contact.
7. The dashboard KPIs update from the logged calls.

---

## Project structure

```
callcenter-platform/
├── db/
│   ├── schema.sql          all MySQL tables
│   ├── migrate.mjs         builds the schema
│   └── seed.mjs            demo users / campaign / calls
├── asterisk/
│   └── pjsip-agents.conf   WebRTC endpoints 6001-6006
├── src/
│   ├── middleware.ts       route protection (Edge)
│   ├── types/              shared TypeScript types
│   ├── lib/
│   │   ├── db.ts           MySQL pool + prepared-statement helpers
│   │   ├── jwt.ts          JWT sign/verify (jose, Edge-safe)
│   │   ├── password.ts     bcrypt hashing
│   │   ├── session.ts      current-user helpers (server components)
│   │   ├── api.ts          API auth + JSON response helpers
│   │   ├── rbac.ts         role → route mapping
│   │   ├── metrics.ts      employee dashboard queries
│   │   └── sipPhone.ts     JsSIP WebRTC wrapper
│   ├── components/         React components
│   └── app/
│       ├── login/          login page
│       ├── employee/       dashboard + dialer
│       ├── admin|manager|tl/  console shells
│       └── api/            route handlers
```

---

## API reference

All endpoints return JSON. Protected endpoints require the `cc_token` cookie
(set on login). Roles are enforced server-side.

| Method | Endpoint                          | Role     | Purpose                          |
|--------|-----------------------------------|----------|----------------------------------|
| POST   | `/api/auth/login`                 | public   | Log in, set session cookie       |
| POST   | `/api/auth/logout`                | any      | Clear the session cookie         |
| GET    | `/api/auth/me`                    | any      | Current user                     |
| GET    | `/api/employee/sip`               | employee | SIP/WebRTC credentials           |
| GET    | `/api/employee/campaigns`         | employee | Active campaigns                 |
| GET    | `/api/employee/dialer/next`       | employee | Next un-called contact (FIFO)    |
| POST   | `/api/employee/calls`             | employee | Log a finished call + note       |
| GET    | `/api/employee/calls`             | employee | Recent calls (20)                |
| GET    | `/api/employee/dashboard`         | employee | KPIs, 7-day chart, schedules     |

**POST `/api/employee/calls`** body:

```json
{
  "phoneNumber": "9818435920",
  "contactName": "Rohan Sharma",
  "campaignId": 1,
  "csvDataId": 4,
  "status": "connected",
  "durationSeconds": 142,
  "note": "Interested, call back next week",
  "tags": "interested,warm",
  "followUpAt": "2026-05-28T15:30"
}
```

---

## Security notes

- Passwords hashed with **bcrypt**; never stored or returned in plaintext.
- Sessions are **JWT** in an `httpOnly`, `sameSite=lax` cookie.
- Every DB query uses **parameterised prepared statements** (`mysql2.execute`).
- All API input is validated with **zod**.
- Route protection runs in **middleware** plus a server-side role check.
- For production: serve over **HTTPS**, set a strong `JWT_SECRET`, and set
  `NODE_ENV=production` (enables the `secure` cookie flag).

---

## Testing the build

1. `npm run db:reset` then `npm run dev`.
2. Log in as each role — confirm each lands on its own console and cannot open
   another role's URL (e.g. `emp1` opening `/admin/dashboard` is redirected).
3. As `emp1@cc.test`, open **Dashboard** — KPIs and the chart show seeded data.
4. Open **Dialer**, wait for "Phone registered", make a manual call, hang up,
   fill the wrap-up form, save — the call appears on the dashboard.
5. Switch to **Auto** mode, pick "Spring Outreach 2026", load a contact, call,
   wrap up — the next contact loads automatically.

A formal test suite (unit + integration) is part of a later phase; see roadmap.

---

## Build phases — all complete

- **Phase 1 ✓** Foundation, Auth + RBAC, Employee Dialer & Dashboard.
- **Phase 2 ✓** Real-time layer (Socket.io): live agent presence, call status,
  and live performance / break updates across the consoles.
- **Phase 3 ✓** Admin / Manager / Team Lead consoles: account & team
  management, performance dashboards, break approvals.
- **Phase 4 ✓** Campaigns with CSV upload, call reports with CSV export,
  system settings, audit-log viewer.

Possible future work: an automated test suite, PDF report export, and
per-employee campaign assignment.

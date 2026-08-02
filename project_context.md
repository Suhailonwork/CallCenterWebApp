# PROJECT_CONTEXT.md — Call Center Web Application

> **Last updated**: 2026-06-23
> **Source of truth** for all AI assistants, developers, and architects working on this codebase.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Folder Structure](#4-folder-structure)
5. [Database Documentation](#5-database-documentation)
6. [API Documentation](#6-api-documentation)
7. [Authentication](#7-authentication)
8. [User Roles](#8-user-roles)
9. [Business Logic & Workflows](#9-business-logic--workflows)
10. [Telephony Integration](#10-telephony-integration)
11. [Environment Variables](#11-environment-variables)
12. [Known Issues & Technical Debt](#12-known-issues--technical-debt)
13. [Current Features](#13-current-features)
14. [Missing Features / Roadmap](#14-missing-features--roadmap)
15. [Development Rules](#15-development-rules)
16. [AI Assistant Instructions](#16-ai-assistant-instructions)

---

## 1. Project Overview

### Purpose

A **production-grade, browser-based call center platform** that enables agents to make and receive phone calls through the browser using WebRTC, with calls routed through Asterisk PBX and Dinstar GSM gateways to the PSTN. The system supports manual dialing, predictive (power) dialing, inbound call routing, campaign management, lead tracking, real-time agent monitoring, and comprehensive reporting.

### Business Requirements

- Agents must be able to dial contacts from uploaded CSV lists directly from their browser
- Calls route through physical GSM gateways (Dinstar) via Asterisk PBX
- Team Leads and Managers need real-time visibility into agent activity
- Campaigns are owned by groups; agents and TLs only see their group's campaigns
- Post-call disposition tracking with Hindi-oriented debt collection categories (PAID, PTP, SETT, CB, etc.)
- Predictive dialing: server pre-dials contacts and only delivers answered calls to agents
- Call recordings stored on the Asterisk server, retrievable via SFTP
- Break request/approval workflow for agents
- Comprehensive audit logging of all sensitive actions
- Role-based access: Admin > Manager > Team Lead > Employee (Agent)

### Target Users

| Role | Description |
|------|-------------|
| **Admin** | System administrator. Full control over users, campaigns, gateways, groups, settings, reports, and audit logs. |
| **Manager** | Oversees multiple teams. Views team performance, approves breaks. |
| **Team Lead (TL)** | Manages agents within their group(s). Creates campaigns for their groups, approves breaks, monitors agent performance. |
| **Employee (Agent)** | Call center agent. Dials contacts via browser softphone, logs call dispositions, requests breaks, views personal dashboard. |

### Core Workflows

1. **Campaign Lifecycle**: Admin/TL creates campaign → assigns to group → uploads CSV contacts → agents dial contacts → disposition logged → reports generated
2. **Manual Dialing**: Agent selects campaign → clicks "Next Contact" → SIP call placed via browser → post-call wrap-up form → next contact
3. **Predictive Dialing**: Agent starts dialer → server auto-dials contacts via ARI → answered call bridged to agent → screen pop with contact info → wrap-up
4. **Break Management**: Agent requests break → TL/Manager approves/denies → agent goes on break → break ends
5. **Inbound Routing**: External call arrives via Dinstar trunk → Asterisk routes to first available online agent

---

## 2. System Architecture

### Frontend Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Next.js 14 (App Router)                  │
│                                                            │
│  Pages (SSR + Client Components)                           │
│  ├── /login           — Authentication                     │
│  ├── /employee/*      — Agent workspace (dashboard, dialer)│
│  ├── /tl/*            — Team Lead console                  │
│  ├── /manager/*       — Manager console                    │
│  └── /admin/*         — Admin console                      │
│                                                            │
│  Client-Side Libraries                                     │
│  ├── JsSIP (WebRTC softphone via WSS to Asterisk)          │
│  ├── Socket.IO Client (real-time agent presence & events)  │
│  └── Recharts (dashboard charts)                           │
│                                                            │
│  State Management: React hooks + Socket.IO events          │
│  (No Redux/Zustand — server components + router.refresh()) │
└────────────────────────────────────────────────────────────┘
```

### Backend Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      server.mjs (Entry Point)                 │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │  HTTPS Server │  │  Socket.IO   │  │  Next.js Handler   │ │
│  │  (TLS certs)  │  │  (realtime)  │  │  (pages + API)     │ │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘ │
│         │                 │                    │              │
│  ┌──────┴─────────────────┴────────────────────┴───────────┐ │
│  │              Agent Presence Map (in-memory)              │ │
│  │   Map<userId, {id,name,state,available,extension,       │ │
│  │                 campaignId}>                              │ │
│  └─────────────────────────┬───────────────────────────────┘ │
│                            │                                  │
│  ┌─────────────────────────┴───────────────────────────────┐ │
│  │                                                         │ │
│  │   ari-app.js              predictive-engine.js          │ │
│  │   (Asterisk ARI           (Power dialer loop            │ │
│  │    call control)            every 1.5s)                 │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Database Architecture

```
MySQL 8 (InnoDB, utf8mb4)

Core Tables:
  users ─── teams ─── employees
    │                    │
    ├── groups ──────── group_tl / group_agents
    │     │
    ├── campaigns ──── csv_data (contacts/leads)
    │     │              │
    │     ├── campaign_assignments
    │     └── campaign_gateways ── gsm_gateways
    │
    ├── calls ───────── call_notes ── scheduled_calls
    │
    ├── breaks
    ├── performance (daily rollup)
    ├── agent_sessions (login tracking)
    ├── audit_logs
    └── settings

Asterisk Realtime Tables:
  ps_endpoints ── ps_auths ── ps_aors ── ps_endpoint_id_ips
```

### Telephony Architecture

```
┌─────────┐    WSS     ┌──────────┐    SIP/UDP    ┌──────────┐   GSM/PSTN
│ Browser  │◄─────────►│ Asterisk │◄────────────►│  Dinstar  │◄─────────►  Customer
│ (JsSIP)  │   WebRTC  │   PBX    │    PJSIP     │  Gateway  │
└─────────┘            │          │               └──────────┘
                       │   ARI    │
              HTTP     │  (REST)  │
┌──────────┐◄─────────►│          │
│ server.mjs│          └──────────┘
│ ari-app.js│
│ engine.js │
└──────────┘
```

### Infrastructure Architecture

```
┌────────────────────────┐     ┌──────────────────────┐
│   App Server           │     │   Asterisk Server     │
│   (Node.js / Next.js)  │     │   (IP: 192.168.0.101) │
│                        │     │                      │
│   - HTTPS :4000        │────►│   - SIP :5060 (UDP)  │
│   - Socket.IO          │ ARI │   - WSS :8089        │
│   - ARI Client         │────►│   - ARI :8088 (HTTP) │
│   - Predictive Engine  │     │   - Recordings dir   │
│                        │     │     /var/spool/       │
└────────┬───────────────┘     │     asterisk/recording│
         │                     └──────────────────────┘
         │ MySQL :3306
┌────────▼───────────────┐     ┌──────────────────────┐
│   MySQL 8 Server       │     │   Dinstar GSM Gateway │
│   (IP: 100.106.191.36) │     │   (physical device)   │
│   Database: dialer     │     │   - SIP trunk to      │
│                        │     │     Asterisk           │
└────────────────────────┘     │   - GSM SIM channels  │
                               └──────────────────────┘
```

---

## 3. Tech Stack

### Languages

| Language | Usage |
|----------|-------|
| TypeScript | Frontend components, API routes, libraries |
| JavaScript (ES Modules) | server.mjs, ari-app.js, predictive-engine.js, DB migrations |
| SQL | Schema definitions, migrations |

### Frameworks

| Framework | Version | Usage |
|-----------|---------|-------|
| Next.js | ^14.2.5 | App Router, SSR, API routes, middleware |
| React | ^18.3.1 | UI components |
| Tailwind CSS | ^3.4.1 | Styling |

### Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `socket.io` / `socket.io-client` | ^4.8.x | Real-time bidirectional communication |
| `mysql2` | ^3.22.3 | MySQL driver (promise-based, prepared statements) |
| `ari-client` | ^2.2.0 | Asterisk REST Interface client |
| `jssip` | ^3.10.1 | SIP/WebRTC softphone in the browser |
| `jose` | ^5.9.6 | JWT signing/verification (Edge-runtime safe) |
| `bcryptjs` | ^2.4.3 | Password hashing (cost factor 10) |
| `zod` | ^3.23.8 | Request validation schemas |
| `date-fns` | ^3.6.0 | Date formatting and manipulation |
| `recharts` | ^2.12.7 | Dashboard charts |
| `react-toastify` | ^10.0.5 | Toast notifications |
| `ssh2-sftp-client` | ^12.1.1 | SFTP for call recording downloads |

### External Services

| Service | Purpose |
|---------|---------|
| Asterisk PBX | SIP server, call routing, ARI call control, recordings |
| Dinstar GSM Gateway | Physical SIP-to-GSM bridge for PSTN connectivity |
| MySQL 8 | Primary database + Asterisk PJSIP realtime storage |

---

## 4. Folder Structure

```
CallCenterWebApp/
│
├── server.mjs                    # HTTPS server entry point (Next.js + Socket.IO + ARI + Engine)
├── ari-app.js                    # Asterisk ARI call control (outbound, inbound, predictive)
├── predictive-engine.js          # Predictive dialer loop (claims contacts, originates GSM calls)
├── package.json                  # Dependencies and npm scripts
├── .env                          # Environment variables (DB, ARI, JWT, SIP, SSH)
├── next.config.mjs               # Next.js configuration
├── tsconfig.json                 # TypeScript config (strict, @/* alias to src/*)
├── tailwind.config.ts            # Tailwind CSS config
├── postcss.config.mjs            # PostCSS + Tailwind plugin
│
├── db/
│   ├── schema.sql                # ★ SINGLE SOURCE OF TRUTH for all MySQL tables
│   ├── migrate.mjs               # Drops & recreates all tables from schema.sql
│   ├── migrate-groups.mjs        # Additive migration for groups module (safe on live DB)
│   ├── seed.mjs                  # Seed demo data (users, teams, campaigns, contacts)
│   └── migrations/
│       └── 001-groups.sql        # Groups tables SQL (referenced by migrate-groups.mjs)
│
├── asterisk-config/
│   ├── pjsip.conf                # PJSIP transports (UDP, WSS), browser endpoint 6001, dinstar trunk
│   ├── extensions.conf           # Dialplan contexts: from-webrtc, from-dinstar → Stasis(callapp)
│   ├── ari.conf                  # ARI users: admin (read-write), dialer (automated)
│   ├── extconfig.conf            # Realtime mapping: PJSIP → MySQL via ODBC
│   ├── sorcery.conf              # Sorcery wizard: ps_endpoints, ps_aors, ps_auths → realtime,odbc
│   ├── res_odbc.conf             # ODBC connection to MySQL
│   ├── http.conf                 # Asterisk HTTP server (for ARI + WSS)
│   ├── modules.conf              # Asterisk module loading
│   └── keys/                     # TLS certificates for HTTPS + WSS
│       ├── server.crt / server.key  # Node.js HTTPS
│       └── asterisk.crt / asterisk.key  # Asterisk WSS
│
├── src/
│   ├── middleware.ts              # Edge-runtime route protection (JWT verify + role check)
│   │
│   ├── types/
│   │   ├── index.ts              # All TypeScript interfaces & types
│   │   └── jssip.d.ts            # JsSIP type declarations
│   │
│   ├── lib/                      # Shared backend & frontend libraries
│   │   ├── db.ts                 # MySQL connection pool + query<T> / queryOne<T> helpers
│   │   ├── jwt.ts                # signToken / verifyToken (jose, Edge-safe, HS256)
│   │   ├── password.ts           # bcrypt hash / verify
│   │   ├── api.ts                # authenticate(roles?) + ok() / fail() response helpers
│   │   ├── rbac.ts               # ROLE_HOME map + roleForPath() for route matching
│   │   ├── session.ts            # getSession() / getCurrentUser() from JWT cookie
│   │   ├── sessions.ts           # openSession / closeSession / loginSecondsByEmployee
│   │   ├── audit.ts              # logAudit() — fire-and-forget, transaction-safe
│   │   ├── groups.ts             # Group RBAC: listGroups, agentCanAccessCampaign, tlOwnsCampaign, etc.
│   │   ├── org.ts                # Org queries: listUsers, listTeams, employeesUnderTL, etc.
│   │   ├── orgMetrics.ts         # systemKpis(), statsForEmployees()
│   │   ├── metrics.ts            # getEmployeeDashboard() — KPIs, chart, recent calls
│   │   ├── breaks.ts             # Break request logic: approve, deny, complete
│   │   ├── csv.ts                # parseCsv() + mapColumns() for contact upload
│   │   ├── settings.ts           # getSettings() / updateSettings()
│   │   ├── asteriskRealtime.ts   # PJSIP realtime provisioning (employee + gateway endpoints)
│   │   ├── sipPhone.ts           # ★ JsSIP WebRTC wrapper (SipPhone class) — browser only
│   │   ├── useSocket.ts          # Socket.IO client hook: getSocket() + useSocketEvent()
│   │   └── realtime.ts           # broadcastChange('calls'|'breaks') via globalThis.__ccio
│   │
│   ├── components/               # React UI components (26 total)
│   │   ├── Dialer.tsx            # ★ Main dialer: manual/predictive modes, SIP phone, wrap-up
│   │   ├── EmployeeShell.tsx     # Employee layout wrapper (sidebar nav, session tracking)
│   │   ├── ConsoleShell.tsx      # Manager/Admin/TL layout (configurable sidebar nav)
│   │   ├── AdminDashboard.tsx    # System KPIs, employee stats, live agents
│   │   ├── ManagerDashboard.tsx  # Manager team performance view
│   │   ├── CampaignManager.tsx   # Campaign CRUD, CSV upload, gateway assignment
│   │   ├── CampaignDetail.tsx    # Campaign contacts, agent stats, call history
│   │   ├── CampaignAssign.tsx    # Agent-to-campaign assignment UI
│   │   ├── GroupManager.tsx      # Group CRUD, TL/agent membership management
│   │   ├── GatewayManager.tsx    # GSM gateway CRUD, PJSIP provisioning, status check
│   │   ├── BreakWidget.tsx       # Agent break request/status widget
│   │   ├── BreakApprovals.tsx    # TL/Manager break approval table
│   │   ├── LiveAgents.tsx        # Real-time agent presence display
│   │   ├── LiveRefresh.tsx       # Socket.IO listener that calls router.refresh()
│   │   ├── AgentStatsTable.tsx   # Live agent statistics with auto-refresh
│   │   ├── DashboardView.tsx     # Employee KPI dashboard (chart, recent calls, scheduled)
│   │   ├── CustomerHistory.tsx   # Call history for a phone number
│   │   ├── AuditLogView.tsx      # Searchable audit log viewer
│   │   ├── ReportsView.tsx       # Call reports with filters + CSV export
│   │   ├── SettingsForm.tsx      # System settings editor
│   │   ├── Button.tsx            # Reusable button with loading state
│   │   └── ToastProvider.tsx     # react-toastify wrapper
│   │
│   └── app/                      # Next.js App Router pages & API routes
│       ├── page.tsx              # Root redirect (→ role home)
│       ├── login/page.tsx        # Login page with demo credentials
│       │
│       ├── employee/
│       │   ├── dashboard/page.tsx    # Agent KPI dashboard
│       │   └── dialer/page.tsx       # Agent dialer page
│       │
│       ├── tl/
│       │   ├── dashboard/page.tsx    # TL team performance dashboard
│       │   ├── campaigns/page.tsx    # TL campaign list (group-scoped)
│       │   ├── campaigns/[id]/page.tsx
│       │   ├── customers/[phone]/page.tsx
│       │   ├── breaks/page.tsx       # Break approvals
│       │   └── groups/route.ts       # TL groups API
│       │
│       ├── manager/
│       │   ├── dashboard/page.tsx    # Manager overview
│       │   ├── campaigns/page.tsx    # Campaign view
│       │   └── breaks/page.tsx       # Break approvals
│       │
│       ├── admin/
│       │   ├── layout.tsx            # Admin layout
│       │   ├── dashboard/page.tsx    # System dashboard
│       │   ├── users/page.tsx        # User management
│       │   ├── campaigns/page.tsx    # All campaigns
│       │   ├── campaigns/[id]/page.tsx
│       │   ├── campaigns/customers/[phone]/page.tsx
│       │   ├── customers/[phone]/page.tsx
│       │   ├── gateways/page.tsx     # Gateway management
│       │   ├── groups/page.tsx       # Group management
│       │   ├── reports/page.tsx      # Call reports
│       │   ├── settings/page.tsx     # System settings
│       │   └── audit/page.tsx        # Audit log viewer
│       │
│       └── api/                      # ~39 API route handlers
│           ├── auth/                 # Login, logout, me
│           ├── employee/             # SIP config, campaigns, dialer, calls, breaks, dashboard
│           ├── admin/                # Users, campaigns, gateways, groups, reports, settings, audit
│           ├── manager/              # Team overview
│           ├── tl/                   # Group-scoped campaigns, overview, groups
│           ├── breaks/               # Shared break management
│           ├── campaigns/            # Campaign assignments
│           └── recordings/           # Call recording retrieval via SFTP
│
├── generate-pjsip.mjs           # Utility: generates PJSIP config from DB
├── diagnose-asterisk.sh          # Diagnostic script for Asterisk connectivity
├── gen-webrtc-cert.sh            # Certificate generation utility
└── start                         # Shell script launcher
```

---

## 5. Database Documentation

### Table: `users`

| Column | Type | Purpose |
|--------|------|---------|
| id | INT PK AUTO_INCREMENT | User identifier |
| name | VARCHAR(120) | Display name |
| email | VARCHAR(180) UNIQUE | Login email |
| password_hash | VARCHAR(255) | bcrypt hash |
| role | ENUM('admin','manager','tl','employee') | Access level |
| team_id | INT FK → teams | Team membership |
| reports_to | INT FK → users | Org hierarchy (manager/TL) |
| is_active | TINYINT(1) | Soft delete flag |
| created_at / updated_at | DATETIME | Timestamps |

**Relationships**: FK to teams (team_id), self-referential FK (reports_to). Referenced by: employees, calls, campaign_assignments, group_tl, group_agents, breaks, audit_logs, agent_sessions.
**Business usage**: Central identity table for all account types. Every authentication and authorization check starts here.

---

### Table: `teams`

| Column | Type | Purpose |
|--------|------|---------|
| id | INT PK AUTO_INCREMENT | Team identifier |
| name | VARCHAR(120) | Team name |
| manager_id | INT FK → users | Owning manager |
| tl_id | INT FK → users | Assigned team lead |

**Business usage**: Organizational grouping of employees under a manager + TL.

---

### Table: `employees`

| Column | Type | Purpose |
|--------|------|---------|
| id | INT PK AUTO_INCREMENT | Row ID |
| user_id | INT UNIQUE FK → users | Links to user account |
| sip_extension | VARCHAR(32) | Asterisk SIP extension (e.g., "6001") |
| sip_password | VARCHAR(64) | SIP auth password (random, generated on user creation) |
| status | ENUM('offline','available','on_call','break') | Current phone status |
| break_status | VARCHAR(32) | Active break type |

**Business usage**: Stores SIP credentials for each agent. The sip_extension is used to register with Asterisk via WebRTC. Auto-provisioned into ps_endpoints on user creation.

---

### Table: `groups`

| Column | Type | Purpose |
|--------|------|---------|
| id | INT PK AUTO_INCREMENT | Group identifier |
| name | VARCHAR(120) UNIQUE | Group name |
| description | VARCHAR(500) | Optional description |
| created_by | INT FK → users | Creator |

**Business usage**: Named ownership unit for campaigns. A group contains TLs and agents. Campaigns with group_id can only be accessed by that group's members.

---

### Table: `group_tl`

| Column | Type | Purpose |
|--------|------|---------|
| group_id | INT FK → groups | Group |
| tl_id | INT FK → users | Team Lead |

**Unique constraint**: (group_id, tl_id). A group can have multiple TLs.

---

### Table: `group_agents`

| Column | Type | Purpose |
|--------|------|---------|
| group_id | INT FK → groups | Group |
| agent_id | INT FK → users | Agent (employee) |

**Unique constraint**: (group_id, agent_id). Agents access campaigns through group membership.

---

### Table: `campaigns`

| Column | Type | Purpose |
|--------|------|---------|
| id | INT PK AUTO_INCREMENT | Campaign identifier |
| name | VARCHAR(150) | Campaign name |
| description | TEXT | Description |
| script | TEXT | Agent call script |
| created_by | INT FK → users | Creator |
| group_id | INT FK → groups (nullable) | Owning group (NULL = admin-only/legacy) |
| status | ENUM('active','paused','completed') | Campaign state |
| dialer_type | ENUM('predictive','manual','inbound','ratio') | Dialing mode |
| calling_start / calling_end | TIME | Allowed calling window |
| retry_count | INT | Max retry attempts |
| retry_delay_minutes | INT | Delay between retries |

**Business usage**: The core organizing entity for outbound calling. Each campaign has contacts (csv_data), assigned gateways, and is owned by a group. The dialer_type determines whether the predictive engine or manual mode is used.

---

### Table: `csv_data`

| Column | Type | Purpose |
|--------|------|---------|
| id | INT PK AUTO_INCREMENT | Contact identifier |
| campaign_id | INT FK → campaigns | Parent campaign |
| phone_number | VARCHAR(32) | Dialing number |
| name / email / company | VARCHAR | Contact info |
| custom_fields | JSON | Arbitrary extra columns from CSV |
| called | TINYINT(1) | 0=not yet called, 1=called |
| call_status | VARCHAR(32) | Last disposition |
| assigned_to | INT FK → users | Agent who claimed this contact |
| claimed_at | DATETIME | When an agent claimed this contact |

**Hot-path index**: `(campaign_id, called)` — used by the dialer to find the next uncalled contact.
**Business usage**: Uploaded via CSV. The auto-dialer claims contacts atomically with `SELECT ... FOR UPDATE` + `claimed_at` to prevent race conditions between agents. Contacts with `claimed_at > 2 min ago` and `called=0` are reclaimed (timeout protection).

---

### Table: `calls`

| Column | Type | Purpose |
|--------|------|---------|
| id | INT PK AUTO_INCREMENT | Call record ID |
| employee_id | INT FK → users | Agent who made/received the call |
| campaign_id | INT FK → campaigns | Associated campaign |
| csv_data_id | INT FK → csv_data | Contact record |
| phone_number | VARCHAR(32) | Dialed/received number |
| contact_name | VARCHAR(150) | Contact display name |
| direction | ENUM('inbound','outbound') | Call direction |
| status | ENUM('connected','no_answer','busy','failed','voicemail','wrong_number','completed') | Disposition |
| duration_seconds | INT | Call duration |
| started_at / ended_at | DATETIME | Call timestamps |
| recording_url | VARCHAR(255) | Path to recording file on Asterisk |

**Indexes**: `(employee_id, created_at)` for dashboard queries, `(campaign_id, created_at)` for campaign reports.
**Business usage**: One row per call attempt. Linked to call_notes for post-call disposition.

---

### Table: `call_notes`

| Column | Type | Purpose |
|--------|------|---------|
| call_id | INT FK → calls | Parent call |
| employee_id | INT FK → users | Agent |
| note | TEXT | Free-text notes |
| tags | VARCHAR(255) | Disposition tags (e.g., "PTP", "PAID", "CB") |
| follow_up_at | DATETIME | Scheduled follow-up time |

**Business usage**: Post-call wrap-up data. Tags contain the Hindi-oriented disposition codes used in debt collection.

---

### Table: `scheduled_calls`

| Column | Type | Purpose |
|--------|------|---------|
| phone_number | VARCHAR(32) | Number to call back |
| contact_name | VARCHAR(150) | Contact name |
| scheduled_at | DATETIME | When to call back |
| assigned_to | INT FK → users | Assigned agent |
| status | ENUM('pending','done','missed','cancelled') | Follow-up status |

**Business usage**: Created when an agent sets a follow-up date during wrap-up. Displayed on the agent's dashboard.

---

### Table: `breaks`

| Column | Type | Purpose |
|--------|------|---------|
| employee_id | INT FK → users | Requesting agent |
| break_type | ENUM('lunch','short','other') | Break category |
| reason | VARCHAR(255) | Optional reason |
| status | ENUM('requested','approved','denied','active','completed') | Break state |
| start_time / end_time | DATETIME | Actual break duration |
| approved_by | INT FK → users | Approving TL/Manager |

**Business usage**: Formal break request workflow. Agents request, TLs/Managers approve. Break time is tracked in performance metrics.

---

### Table: `performance`

| Column | Type | Purpose |
|--------|------|---------|
| employee_id | INT FK → users | Agent |
| date | DATE | Performance date |
| calls_made / calls_connected | INT | Call counts |
| success_rate | DECIMAL(5,2) | Connected / Made ratio |
| total_duration_seconds | INT | Total talk time |
| break_duration_seconds | INT | Total break time |

**Unique key**: `(employee_id, date)`. Updated with `INSERT ... ON DUPLICATE KEY UPDATE` after each call.

---

### Table: `agent_sessions`

| Column | Type | Purpose |
|--------|------|---------|
| employee_id | INT FK → users | Agent |
| login_at | DATETIME | Session start |
| logout_at | DATETIME (nullable) | Session end (NULL = still logged in) |

**Business usage**: Tracks agent login hours for compliance and reporting.

---

### Table: `gsm_gateways`

| Column | Type | Purpose |
|--------|------|---------|
| id | INT PK AUTO_INCREMENT | Gateway ID |
| name | VARCHAR(100) | Display name |
| ip | VARCHAR(64) | Gateway IP address |
| port | SMALLINT | SIP port (default 5060) |
| channels | SMALLINT | Number of GSM SIM channels |
| status | ENUM('active','inactive') | Gateway state |
| asterisk_endpoint | VARCHAR(100) | Auto-generated PJSIP endpoint name (e.g., "gw1") |
| notes | VARCHAR(255) | Admin notes |

**Business usage**: Physical GSM gateway devices. When created/updated with status='active', PJSIP realtime tables are auto-provisioned and ARI triggers a reload+qualify for immediate status detection.

---

### Table: `campaign_gateways`

Many-to-many: campaigns ↔ gsm_gateways. Determines which gateway an agent's call routes through.

---

### Table: `campaign_assignments`

Many-to-many: campaigns ↔ employees. Legacy per-agent assignment (group-based is primary now).

---

### Table: `audit_logs`

| Column | Type | Purpose |
|--------|------|---------|
| user_id | INT FK → users | Acting user |
| action | VARCHAR(100) | Action name (e.g., 'create_user', 'login', 'delete_gateway') |
| entity | VARCHAR(60) | Table/object type |
| entity_id | INT | Affected row PK |
| details | JSON | Extra structured context |
| ip | VARCHAR(64) | Client IP address |

**Business usage**: Security audit trail. All sensitive actions logged. Writes never fail the parent request.

---

### Table: `settings`

Key-value store for system configuration (e.g., `break_minutes_per_day`, `max_breaks_per_day`, `call_limit_per_day`, `work_start`, `work_end`, `min_password_length`, `recording_retention_days`).

---

### Asterisk Realtime Tables

| Table | Purpose |
|-------|---------|
| `ps_endpoints` | SIP endpoint definitions (WebRTC agents + GSM gateways) |
| `ps_auths` | Authentication credentials per endpoint |
| `ps_aors` | Address-of-Record (contact bindings, qualify frequency) |
| `ps_endpoint_id_ips` | IP-based endpoint identification (for gateways) |

Asterisk reads these tables live via `res_odbc` + Sorcery wizards. The app provisions them through `asteriskRealtime.ts` — no manual pjsip.conf editing required.

---

## 6. API Documentation

### Authentication APIs

#### `POST /api/auth/login`
- **Purpose**: Authenticate user and issue JWT
- **Request**: `{ email: string, password: string }`
- **Response**: `{ user: { id, name, email, role }, redirect: string }`
- **Side effects**: Sets `cc_token` httpOnly cookie, opens agent_session for employees, logs audit

#### `POST /api/auth/logout`
- **Purpose**: End session
- **Response**: `{ ok: true }`
- **Side effects**: Clears cookie, closes agent_session

#### `GET /api/auth/me`
- **Purpose**: Get current authenticated user
- **Response**: `{ id, name, email, role }`

---

### Employee APIs

#### `GET /api/employee/sip`
- **Purpose**: Get SIP/WebRTC credentials for browser phone
- **Response**: `{ wssUrl, sipServer, extension, password, displayName }`

#### `GET /api/employee/campaigns`
- **Purpose**: Get campaigns the agent can access (via group membership)
- **Response**: `{ campaigns: CampaignRow[] }`

#### `GET /api/employee/dialer/next?campaignId=N`
- **Purpose**: Claim the next uncalled contact (atomic FIFO with SELECT ... FOR UPDATE)
- **Response**: `{ contact: { id, phone_number, name, email, company } | null }`
- **RBAC**: Validates agent is in campaign's group via `agentCanAccessCampaign()`

#### `POST /api/employee/calls`
- **Purpose**: Log a completed call with disposition, notes, and optional follow-up
- **Request**: `{ phoneNumber, contactName, campaignId, csvDataId, status, durationSeconds, note, tags, followUpAt }`
- **Response**: `{ callId: number }`
- **Side effects**: Updates csv_data.called=1, inserts call_notes, inserts scheduled_calls (if followUpAt), updates performance rollup, broadcasts `data-changed: calls`

#### `GET /api/employee/calls`
- **Purpose**: Agent's recent 20 calls
- **Response**: `{ calls: CallRow[] }`

#### `GET /api/employee/dashboard`
- **Purpose**: Agent KPIs + 7-day chart + recent calls + scheduled follow-ups
- **Response**: `{ today: {calls,connected,successRate,durationSeconds,breakSeconds}, scheduledCount, chart, recentCalls, scheduled }`

#### `GET /api/employee/breaks` / `POST /api/employee/breaks`
- **Purpose**: List/create break requests
- **POST Request**: `{ breakType: "lunch"|"short"|"other", reason?: string }`

#### `GET /api/employee/gateway-status?campaignId=N`
- **Purpose**: Check if the campaign's gateway is reachable

---

### Admin APIs

#### `GET /api/admin/users` / `POST /api/admin/users`
- **GET**: All users + teams
- **POST**: Create user. For employees: auto-generates SIP extension, provisions PJSIP endpoint

#### `PATCH /api/admin/users/[id]` / `DELETE /api/admin/users/[id]`
- **PATCH**: Update name, teamId, password
- **DELETE**: Soft-deactivate (is_active=0)

#### `GET /api/admin/campaigns` / `POST /api/admin/campaigns`
- **POST**: `{ name, description?, script?, dialer_type, gatewayIds[], recording_enabled?, group_id? }`

#### `GET /api/admin/campaigns/[id]/details`
- **Response**: Campaign + gateways + per-agent stats + last 500 calls with notes/recordings

#### `GET /api/admin/campaigns/[id]/contacts`
- **Response**: Paginated contacts with call status

#### `GET /api/admin/gateways` / `POST /api/admin/gateways`
- **POST**: `{ name, ip, port, channels, status, notes? }` → auto-generates "gw{id}", provisions PJSIP, triggers ARI qualify

#### `PATCH /api/admin/gateways/[id]` / `DELETE /api/admin/gateways/[id]`
- **PATCH**: Update gateway config, re-provision PJSIP
- **DELETE**: Remove + deprovision PJSIP

#### `GET /api/admin/gateways/status`
- **Purpose**: Real-time gateway status from Asterisk ARI

#### `GET /api/admin/groups` / `POST /api/admin/groups`
- **POST**: `{ name, description?, tlIds[], agentIds[] }` → validates roles, syncs membership

#### `PATCH /api/admin/groups/[id]`
- **Purpose**: Update group name, description, membership

#### `GET /api/admin/reports`
- **Query params**: `from, to, status, employeeId, format (json|csv)`
- **Response**: `{ rows: CallReportRow[], summary }` or CSV download

#### `GET /api/admin/metrics`
- **Response**: System-wide KPIs + per-employee stats

#### `GET /api/admin/agent-stats`
- **Response**: Real-time agent statistics

#### `GET /api/admin/audit`
- **Query params**: `page, pageSize, action, entity, userId, q`
- **Response**: Paginated audit entries

#### `GET /api/admin/settings` / `POST /api/admin/settings`
- **POST**: `{ key1: value1, key2: value2, ... }`

#### `GET /api/admin/customers/[phone]`
- **Response**: Call history for a phone number

---

### Team Lead APIs

#### `GET /api/tl/campaigns` — Group-scoped campaign list
#### `POST /api/tl/campaigns` — Create campaign (group_id required, validated via `tlOwnsGroup`)
#### `GET /api/tl/campaigns/[id]/details` — Campaign detail (RBAC: `tlOwnsCampaign`)
#### `GET /api/tl/campaigns/[id]/contacts` — Campaign contacts (paginated)
#### `GET /api/tl/groups` — Groups this TL manages
#### `GET /api/tl/overview` — Team overview with KPIs
#### `GET /api/tl/customers/[phone]` — Customer call history

---

### Manager APIs

#### `GET /api/manager/overview` — Team performance dashboard

---

### Shared APIs

#### `GET /api/breaks` / `PATCH /api/breaks/[id]`
- **Auth**: manager or tl
- **PATCH**: Approve/deny/end break

#### `GET /api/campaigns/[id]/assignments` / `POST /api/campaigns/[id]/assignments`
- **Auth**: admin, manager, or tl

#### `GET /api/recordings/[filename]`
- **Purpose**: Stream call recording from Asterisk via SFTP

---

## 7. Authentication

### Login Flow

1. User submits email + password at `/login`
2. Server validates against `users.password_hash` (bcrypt compare)
3. Server checks `is_active = 1`
4. Server creates JWT via `signToken({ sub: userId, role, name, email })`
5. JWT stored in `cc_token` httpOnly cookie (sameSite=lax, secure in production)
6. For employees: `openSession()` records login timestamp in `agent_sessions`
7. Redirect to `ROLE_HOME[user.role]`

### JWT Usage

- **Library**: `jose` (Edge-runtime compatible, no Node.js crypto dependency)
- **Algorithm**: HMAC-SHA256
- **Expiry**: 8 hours (configurable via `JWT_EXPIRES_IN`)
- **Secret**: `JWT_SECRET` environment variable
- **Cookie name**: `cc_token`
- **Cookie flags**: httpOnly, sameSite=lax, secure (in production)
- **Payload**: `{ sub: userId, role, name, email, iat, exp }`

### Permission Model

**Three layers of protection:**

1. **Edge Middleware** (`src/middleware.ts`):
   - Matches: `/admin/*`, `/manager/*`, `/tl/*`, `/employee/*`
   - No token → redirect to `/login?next=pathname`
   - Wrong role → redirect to ROLE_HOME

2. **API Route Authentication** (`src/lib/api.ts → authenticate()`):
   - Extracts JWT from cookie
   - Validates signature + expiry
   - Loads fresh user from DB (ensures is_active=1)
   - Optional role filtering

3. **Data-Level RBAC** (`src/lib/groups.ts`):
   - `agentCanAccessCampaign(agentId, campaignId)` — agent must be in campaign's group
   - `tlOwnsCampaign(tlId, campaignId)` — campaign must belong to TL's group
   - `tlOwnsGroup(tlId, groupId)` — TL must be assigned to the group

---

## 8. User Roles

### Admin
- **Access**: `/admin/*`
- **Capabilities**: Full CRUD on all entities. View all reports, audit logs, system metrics. Create any campaign.
- **Restrictions**: None.

### Manager
- **Access**: `/manager/*`
- **Capabilities**: View team performance. Approve/deny breaks. View campaigns.
- **Restrictions**: Cannot create/edit campaigns, users, gateways, or groups.

### Team Lead (TL)
- **Access**: `/tl/*`
- **Capabilities**: Create campaigns for their group(s). Manage group-scoped campaigns. Approve breaks for group agents. View team performance.
- **Restrictions**: Can only access campaigns in their group(s). No user/gateway/settings management.

### Employee (Agent)
- **Access**: `/employee/*`
- **Capabilities**: Dial contacts. Log dispositions. Set follow-ups. Request breaks. View personal dashboard.
- **Restrictions**: Can only access campaigns in their group(s). No management capabilities.

---

## 9. Business Logic & Workflows

### Campaign Creation

1. Admin navigates to `/admin/campaigns` → "New Campaign"
2. Fills: name, description, script, dialer_type, gateway selection, optional group assignment, recording toggle
3. `POST /api/admin/campaigns` → transaction: insert campaign + campaign_gateways + audit log
4. TLs create via `POST /api/tl/campaigns` (must specify group_id they own)

### Lead Management (CSV Upload)

1. Open campaign detail → "Upload CSV"
2. Frontend parses with `parseCsv()` + `mapColumns()` (detects phone, name, email, company columns)
3. Extra columns stored in `custom_fields` JSON
4. Bulk insert into `csv_data` with `called=0`, `claimed_at=NULL`

### Auto Dialing (Predictive Mode)

1. Agent starts dialer → emits `agent-available` with `{ extension, campaignId }`
2. `predictive-engine.js` tick loop (every 1.5s) detects idle agent:
   a. `gatewayForCampaign()` → gets active gateway
   b. `claimNextContact()` → atomic `SELECT ... FOR UPDATE`
   c. `ari.originatePredictive()` → GSM call via ARI
3. Customer answers → ARI creates bridge → originates agent leg → auto-answer
4. `onConnect()` → engine emits `assigned-call` → browser screen pop
5. No answer → `onFailed()` → next tick retries with new contact

### Manual Dialing

1. Agent clicks "Next Contact" → `GET /api/employee/dialer/next`
2. Clicks "Call" → `SipPhone.call()` → SIP INVITE via WSS
3. Asterisk: `from-webrtc` → Stasis → ARI handles bridge + gateway originate
4. Wrap-up → `POST /api/employee/calls`

### Call Disposition

Post-call wrap-up includes:
- Status: connected, no_answer, busy, voicemail, failed, wrong_number
- **Disposition codes** (Hindi-oriented debt collection): PAID, PC, PTP, SETT, CB, FI, NFI, SI, TNC, SKIP, LM, WN
- Sub-reasons per category
- Payment fields (amount, date, mode) for payment dispositions
- Notes field + follow-up scheduling

### Recording Management

1. ARI starts bridge recording: `rec-{ext}-{number}-{timestamp}.wav`
2. Stored on Asterisk at `ASTERISK_RECORDING_DIR`
3. Retrieval: `GET /api/recordings/[filename]` → SFTP stream

### Break Management

1. Agent requests → `POST /api/employee/breaks` → status='requested'
2. Broadcasts `data-changed: breaks`
3. TL/Manager approves → `PATCH /api/breaks/[id]` → status='active', start_time=NOW()
4. Agent ends → status='completed', end_time=NOW()

---

## 10. Telephony Integration

### Asterisk Integration
- ARI WebSocket from server.mjs to `http://192.168.0.101:8088`
- Auto-retry every 5s on connection failure
- Stasis app: "callapp"
- Dialplan: `from-webrtc` (outbound), `from-dinstar` (inbound) → both route to Stasis

### ARI Call Control (`ari-app.js`)
- **Outbound** (manual): Browser → bridge → GSM leg (dynamic gateway from DB)
- **Inbound**: Trunk → bridge → browser leg (routes to first online agent via ARI endpoint query)
- **Predictive**: Server-originated GSM leg → bridge → server-originated agent leg → screen pop

### SIP Registration (Browser)
1. Fetch `GET /api/employee/sip` → `{ wssUrl, sipServer, extension, password }`
2. JsSIP registers via WSS to `wss://{SIP_SERVER}:8089/ws`
3. Asterisk validates against `ps_auths` table (realtime)

### Browser Phone (`src/lib/sipPhone.ts`)
- JsSIP WebRTC wrapper: `SipPhone` class
- Outbound: `SipPhone.call(target, domain, gatewayEndpoint)`
- Predictive inbound: auto-answers incoming SIP calls
- Events: connecting → ringing (muted, ARI plays ringback) → in-call (unmuted after 500ms) → ended
- DTMF support during calls

### GSM Gateway Provisioning
1. Admin creates gateway → PJSIP tables auto-provisioned
2. ARI reload + SIP OPTIONS qualify sent immediately
3. Calls route: `PJSIP/{number}@gw{id}` → gateway → GSM → customer

### Call Routing

**Outbound**: Browser → WSS → Asterisk → Stasis → ARI → DB gateway lookup → `PJSIP/{number}@{gateway}` → GSM → Customer

**Inbound**: Customer → GSM → Gateway → Asterisk → Stasis → ARI → first online agent → Browser

**Predictive**: Engine → claim contact → ARI originate GSM → customer answers → ARI originate agent → bridge → screen pop

---

## 11. Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `DB_HOST` | MySQL server IP | `100.106.191.36` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | `********` |
| `DB_NAME` | Database name | `dialer` |
| `JWT_SECRET` | HMAC secret for JWT | `********` |
| `JWT_EXPIRES_IN` | Token expiry | `8h` |
| `NODE_ENV` | Environment | `development` / `production` |
| `SERVER_PORT` | HTTPS port | `4000` |
| `TLS_CERT` | TLS certificate path | `./asterisk-config/keys/server.crt` |
| `TLS_KEY` | TLS private key path | `./asterisk-config/keys/server.key` |
| `ARI_URL` | Asterisk ARI endpoint | `http://192.168.0.101:8088` |
| `ARI_USER` | ARI username | `admin` |
| `ARI_PASS` | ARI password | `********` |
| `ARI_APP` | Stasis app name | `callapp` |
| `TRUNK_ENDPOINT` | Default outbound SIP endpoint | `dinstar` |
| `BROWSER_ENDPOINT` | Default agent extension | `6001` |
| `OUTBOUND_PREFIX` | Digits prepended to dialed numbers | (empty) |
| `CALLER_ID` | Outbound caller ID | (empty = dialed number) |
| `SIP_WSS_URL` | Browser WSS URL for SIP | `wss://100.106.191.36:8089/ws` |
| `SIP_SERVER` | Asterisk SIP server IP | `100.106.191.36` |
| `ASTERISK_SSH_HOST` | Asterisk SFTP host | `192.168.0.101` |
| `ASTERISK_SSH_PORT` | SSH port | `22` |
| `ASTERISK_SSH_USER` | SSH username | `dev` |
| `ASTERISK_SSH_PASSWORD` | SSH password | `********` |
| `ASTERISK_RECORDING_DIR` | Recording directory | `/var/spool/asterisk/recording` |

---

## 12. Known Issues & Technical Debt

### Missing Schema Elements

1. **`pending_recordings` table**: Referenced in `ari-app.js` but NOT in `db/schema.sql`. Recording metadata inserts will fail without it.
2. **`recording_enabled` column on `campaigns`**: Referenced in queries but NOT in schema. Needs: `ALTER TABLE campaigns ADD COLUMN recording_enabled TINYINT(1) NOT NULL DEFAULT 0`.

### Predictive Dialer — RESOLVED (see DIALER.md)

The dialer was rebuilt to a VICIdial-style workflow. Run
`npm run db:migrate:vicidial` (additive + idempotent) and read
[DIALER.md](DIALER.md) before changing anything in the call path.

1. ~~`pending_recordings` table missing~~ — created by the migration.
2. ~~`recording_enabled` column missing~~ — created by the migration.
3. ~~RATIO = 1 only~~ — per-campaign `dial_ratio` with true over-dialing;
   the agent is chosen when the customer answers, not before the dial.
4. ~~No AMD~~ — optional, via the `[predictive-amd]` dialplan context and
   `dialer_amd_enabled`. Off by default.
5. ~~No abandon-rate cap~~ — `campaigns.max_abandon_pct` throttles the ratio
   back to 1.0 automatically.

**Rules for anyone touching the call path:**

- `csv_data` lifecycle columns are written ONLY through `src/lib/leadWriter.js`.
- "Which lead may be dialed" is defined ONLY in `src/lib/dialEligibility.js`.
- Lead statuses are defined ONLY in `src/lib/leadStatus.js` (UPPERCASE).
- Agent states go through `src/lib/agentRegistry.js`; a finished call must land
  in WRAPUP, never straight back in the READY pool.

### Technical Debt

6. **Commented-out code**: `ari-app.js` and `sipPhone.ts` contain large commented-out blocks.
7. **In-memory agent presence**: Lost on process restart. Needs Redis for HA.
8. **Single-server only**: Socket.IO + agent map not shareable. Needs Redis adapter for scaling.
9. **No connection pooling for SFTP**: Every recording playback opens new SFTP connection.

### Security Concerns

10. **Default JWT secret**: Must be changed in production.
11. **SSH credentials in plaintext**: In .env file.
12. **No rate limiting**: Login endpoint vulnerable to brute force.
13. **No CSRF token**: Relies only on SameSite=lax.

---

## 13. Current Features

- [x] Manual outbound dialing via WebRTC softphone (JsSIP)
- [x] Predictive (power) dialing — server originates, delivers answered calls
- [x] Inbound call routing to first available agent
- [x] Dynamic gateway selection per campaign
- [x] Call recording (conditional, per campaign)
- [x] Recording playback via SFTP
- [x] Campaign CRUD with four dialer types
- [x] CSV contact upload with flexible header detection
- [x] Atomic contact claiming (prevents double-dial)
- [x] Group-based campaign ownership and RBAC
- [x] Four roles: Admin, Manager, TL, Employee
- [x] JWT authentication with httpOnly cookies
- [x] Edge middleware + API-level + data-level authorization
- [x] User management with auto SIP provisioning
- [x] Agent KPI dashboard with 7-day chart
- [x] Post-call disposition (Hindi debt collection categories)
- [x] Follow-up scheduling
- [x] Break request/approval workflow
- [x] Real-time agent presence (Socket.IO)
- [x] Live dashboard auto-refresh
- [x] GSM gateway management with PJSIP auto-provisioning
- [x] Call reports with filters + CSV export
- [x] Audit logging with searchable viewer
- [x] Customer history lookup by phone
- [x] System settings management
- [x] Agent login-hour tracking

---

## 14. Missing Features / Roadmap

### Predictive Dialer Phase 2
- [ ] AMD (Answering Machine Detection)
- [ ] Over-dialing (RATIO > 1)
- [ ] Abandon-rate cap (~3%)
- [ ] Adaptive pacing algorithm

### Call Features
- [ ] Call transfer (warm/cold)
- [ ] Conference calling (3-way)
- [ ] Call whisper / barge-in for supervisors
- [ ] IVR menus
- [ ] Voicemail drop
- [ ] Click-to-call from contact lists

### Monitoring
- [ ] Real-time call listening
- [ ] Call quality scoring
- [ ] Agent leaderboards
- [ ] SLA dashboards

### Infrastructure
- [ ] Redis for Socket.IO adapter
- [ ] Redis for agent presence persistence
- [ ] Rate limiting
- [ ] CSRF tokens
- [ ] Background job queue
- [ ] Health check endpoints

### Compliance
- [ ] DNC list integration
- [ ] Call time restrictions enforcement
- [ ] Consent tracking
- [ ] Data retention auto-purge

---

## 15. Development Rules

1. **Never break existing functionality.** Every change must be backward-compatible unless explicitly approved.
2. **Reuse existing architecture.** Follow Next.js App Router + API routes + MySQL + Socket.IO patterns.
3. **Reuse existing database tables.** Check if `ALTER TABLE ADD COLUMN` works before creating new tables. `db/schema.sql` is the source of truth.
4. **Avoid duplicate business logic.** Check `src/lib/` for existing helpers first.
5. **Preserve backward compatibility.** Group-based RBAC is primary, but campaign_assignments must still work.
6. **Follow existing coding patterns:**
   - API: `authenticate(roles?) → isError() → ok() / fail()`
   - DB: `query<T>() / queryOne<T>()` with prepared statements
   - Transactions: `getConnection → beginTransaction → commit/rollback → release`
   - Audit: `logAudit()` inside transactions
   - Realtime: `broadcastChange('calls' | 'breaks')`
7. **Always use prepared statements.** Never string-concatenate user input into SQL.
8. **Always log sensitive actions** via `logAudit()`.
9. **PJSIP provisioning is automatic.** Use `asteriskRealtime.ts` functions.
10. **Socket.IO events**: `broadcastChange()` for global, `io.to("agent:"+id)` for targeted.

---

## 16. AI Assistant Instructions

### How to Use This Document

This file is the **single source of truth**. Before making any change:

1. Read the relevant section to understand existing patterns
2. Check `db/schema.sql` before creating tables/columns
3. Check `src/lib/` before writing new helpers
4. Check existing API routes before creating new endpoints
5. Follow the auth pattern: `authenticate(roles?) → isError() → ok()/fail()`

### Architecture Quick Reference

| Need to... | Look at... |
|-------------|-----------|
| Add an API endpoint | `src/app/api/` — copy from similar route |
| Add a UI page | `src/app/{role}/` — copy from similar page |
| Add a React component | `src/components/` |
| Modify DB schema | `db/schema.sql` → `npm run db:migrate` |
| Add group RBAC check | `src/lib/groups.ts` |
| Add real-time update | `src/lib/realtime.ts` → `broadcastChange()` |
| Provision SIP endpoint | `src/lib/asteriskRealtime.ts` |
| Log an audit entry | `src/lib/audit.ts` → `logAudit()` |
| Add Socket.IO event | `server.mjs` (server) + `src/lib/useSocket.ts` (client) |

### Key Files to Read First

1. `server.mjs` — Entry point, Socket.IO, agent presence
2. `db/schema.sql` — Complete database schema
3. `src/lib/api.ts` — Authentication pattern
4. `src/lib/groups.ts` — RBAC model
5. `src/components/Dialer.tsx` — Core calling interface
6. `ari-app.js` — Asterisk call control
7. `predictive-engine.js` — Auto-dialing logic

### Common Mistakes to Avoid

- Do NOT create a new DB pool — use `src/lib/db.ts`
- Do NOT import Node.js crypto in middleware — use `jose`
- Do NOT return password_hash in API responses
- Do NOT trust campaignId/groupId from client without RBAC check
- Do NOT use `io.emit()` directly — use `broadcastChange()` or room-targeted emits
- Do NOT hardcode gateway endpoints — use DB lookup with .env fallback
- Do NOT skip audit logging on sensitive operations

### Running the Project

```bash
npm install
npm run db:migrate    # WARNING: drops all tables
npm run db:seed       # Load demo data
npm run dev           # Development (HTTPS on configured port)
npm run build && npm start prod  # Production
```

### Demo Accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@cc.test | Password123! |
| Manager | manager1@cc.test | Password123! |
| Team Lead | tl1@cc.test | Password123! |
| Employee | emp1@cc.test | Password123! |

---

*This document was generated from complete codebase analysis on 2026-06-23. Keep it updated when making significant architectural changes.*

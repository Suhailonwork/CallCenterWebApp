export type Role = 'admin' | 'manager' | 'tl' | 'employee';
export type DialerType = 'predictive' | 'manual' | 'inbound' | 'ratio';

export interface SipConfig {
  wssUrl: string;
  sipServer: string;
  extension: string;
  password: string;
  displayName: string;
}

export interface CampaignGateway {
  id:                number;
  name:              string;
  asterisk_endpoint: string | null;
}

export interface Campaign {
  id: number;
  name: string;
  description: string | null;
  script: string | null;
  status: string;
  dialer_type: DialerType;
  gateways: CampaignGateway[];
  /** Per-campaign overrides for the disposition dialing rules (JSON column).
   *  The dialer's wrap-up form resolves them through the same module the
   *  server does, so the agent is shown the rule that will actually run. */
  disposition_rules?: unknown;
}

export interface Contact {
  id: number;
  phone_number: string;
  name: string | null;
  email: string | null;
  company: string | null;
  // Object = legacy/no-table contacts; array of [col, value] pairs = contacts
  // imported under a Data Table (ordered). The Dialer renders both shapes.
  custom_fields?: Record<string, unknown> | unknown[] | string | null;
  /** calls.id of the attempt that produced this screen pop — sent back with
   *  the wrap-up so the disposition lands on the same call-history row. */
  call_id?: number | null;
  campaign_id?: number | null;
  list_id?: number | null;
  call_status?: string | null;
  call_count?: number | null;
}

export type CallDisposition =
  | 'connected'
  | 'no_answer'
  | 'busy'
  | 'voicemail'
  | 'failed'
  | 'wrong_number';

export interface CallRow {
  id: number;
  phone_number: string;
  contact_name: string | null;
  status: string;
  duration_seconds: number;
  created_at: string;
}

export interface ScheduledCall {
  id: number;
  phone_number: string;
  contact_name: string | null;
  scheduled_at: string;
  status: string;
}

export interface EmployeeDashboard {
  today: {
    calls: number;
    connected: number;
    successRate: number;
    durationSeconds: number;
    breakSeconds: number;
  };
  scheduledCount: number;
  chart: { date: string; calls: number; connected: number }[];
  recentCalls: CallRow[];
  scheduled: ScheduledCall[];
}

// ---- Phase 3: org management & consoles ----

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  team_id: number | null;
  team_name: string | null;
  shift_id: number | null;
  shift_name: string | null;
  reports_to: number | null;
  is_active: number;
  created_at: string;
}

export interface TeamSummary {
  id: number;
  name: string;
  manager_id: number | null;
  tl_id: number | null;
  manager_name: string | null;
  tl_name: string | null;
}

export interface EmployeeStat {
  id: number;
  name: string;
  status: string;
  calls: number;
  connected: number;
  successRate: number;
  talkSeconds: number;
  loginSeconds: number;
}

export interface SystemKpis {
  employees: number;
  managers: number;
  tls: number;
  teams: number;
  campaigns: number;
  contacts: number;
  callsToday: number;
  connectedToday: number;
  successRate: number;
}

export interface BreakRequest {
  id: number;
  employee_id: number;
  employee_name: string | null;
  break_type: string;
  reason: string | null;
  status: string;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
}

// ---- Phase 4: campaigns, reports, settings, audit ----

export interface CampaignRow {
  id: number;
  name: string;
  description: string | null;
  status: string;
  dialer_type: DialerType;
  created_at: string;
  total_contacts: number;
  called_contacts: number;
  group_id?: number | null;
  group_name?: string | null;
  data_table_id?: number | null;
  /** Lead statuses the dialer may claim (JSON column; array once parsed). */
  dial_statuses?: string[] | string | null;
  /** Auto-retry rules (JSON column; array once parsed). */
  recycle_rules?: RecycleRule[] | string | null;
  /** Overrides for the disposition dialing rules, keyed by code
   *  (JSON column; see src/lib/dispositionRules.js for the defaults). */
  disposition_rules?: Record<string, DispositionRuleOverride> | string | null;
  // ---- pacing (see db/migrate-vicidial.mjs) ----
  /** Lines opened per READY agent; 1.00 = progressive. */
  dial_ratio?: number | string | null;
  /** Max total dial attempts per lead; 0 = unlimited. */
  retry_count?: number | null;
  retry_delay_minutes?: number | null;
  dial_timeout_sec?: number | null;
  /** Breather after a call before the engine opens a new line for the agent. */
  wrapup_seconds?: number | null;
  lead_order?: 'oldest' | 'newest' | 'priority' | 'random' | string | null;
  callbacks_enabled?: number | boolean | null;
  max_abandon_pct?: number | string | null;
  recording_enabled?: number | boolean | null;
  calling_start?: string | null;
  calling_end?: string | null;
}

export interface DataTable {
  id:         number;
  name:       string;
  columns:    string[];
  created_by: number | null;
  created_at: string;
}

// ---- Lists (VICIdial-style lead containers; campaign = rules, list = data) ----

export interface ListRow {
  id: number;
  name: string;
  description: string | null;
  campaign_id: number;
  campaign_name: string;
  active: 'Y' | 'N';
  /** Ordered custom field names stored from CSV uploads; null/[] = store all columns. */
  fields: string[] | null;
  created_at: string;
  lead_count: number;
  /** Leads with called=0 (not dialed since the last reset). */
  fresh_count: number;
  last_call_at?: string | null;
  /** call_status -> lead count (Lists page breakdown). */
  status_counts?: Record<string, number>;
}

export type DupMode = 'none' | 'list' | 'campaign';

export interface RecycleRule {
  status: string;
  delay_min: number;
  max_attempts: number;
}

export type DispositionAction = 'retry' | 'callback' | 'skip' | 'close' | 'dnc';

/** A campaign's override of one disposition's dialing rule. Every field is
 *  optional — what is left out keeps the catalogue's default. */
export interface DispositionRuleOverride {
  status?: string;
  action?: DispositionAction;
  delay_min?: number | null;
  max_attempts?: number | null;
  requires_followup?: boolean;
  /** Per-reason overrides, keyed by the reason text. */
  reasons?: Record<string, Omit<DispositionRuleOverride, 'reasons'>>;
}

export interface CallReportRow {
  id: number;
  employee_name: string | null;
  phone_number: string;
  contact_name: string | null;
  status: string;
  duration_seconds: number;
  campaign_name: string | null;
  created_at: string;
}

export interface AuditRow {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  entity: string | null;
  entity_id: number | null;
  details: unknown | null;
  ip: string | null;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: string;
}

// ---- Attendance & Login Tracking ----

export interface Shift {
  id: number;
  name: string;
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  grace_minutes: number;
  working_hours: number | null;
  is_active: number;
  assigned_count?: number;
  created_at?: string;
}

export type AttendanceStatus = 'on_time' | 'grace' | 'late';

export interface AttendanceBoardRow {
  userId: number;
  name: string;
  email: string;
  role: Role;
  tlName: string | null;
  shiftName: string | null;
  shiftStart: string | null;
  present: boolean;
  online: boolean;
  status: AttendanceStatus | null;
  firstLogin: string | null;
  lastLogout: string | null;
  totalSeconds: number;
  sessions: number;
}

export interface AttendanceSessionRow {
  id: number;
  userId: number;
  userName: string;
  email: string;
  role: Role;
  tlName: string | null;
  shiftName: string | null;
  workDate: string;
  loginAt: string;
  logoutAt: string | null;
  durationSeconds: number;
  status: AttendanceStatus | null;
  lateSeconds: number;
  logoutReason: string | null;
  ip: string | null;
  userAgent: string | null;
  online: boolean;
}

export interface AttendanceSummary {
  totalUsers: number;
  present: number;
  absent: number;
  loggedIn: number;
  loggedOut: number;
  onTime: number;
  grace: number;
  late: number;
  totalWorkSeconds: number;
}

export interface AttendanceResponse {
  board: AttendanceBoardRow[];
  summary: AttendanceSummary;
  rows: AttendanceSessionRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  from: string;
  to: string;
  preset: string;
  tls: { id: number; name: string }[];
}

export interface EmployeeAttendanceData {
  today: {
    firstLogin: string | null;
    lastLogout: string | null;
    totalSeconds: number;
    online: boolean;
    status: AttendanceStatus | null;
  };
  shift: { name: string | null; start: string | null };
  counts: { onTime: number; grace: number; late: number };
  history: {
    id: number;
    workDate: string;
    loginAt: string;
    logoutAt: string | null;
    durationSeconds: number;
    status: AttendanceStatus | null;
    lateSeconds: number;
    shiftName: string | null;
    online: boolean;
  }[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

// ---- Groups module (group-based campaign management) ----

export interface GroupMember {
  id: number;
  name: string;
}

export interface GroupRow {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  tls: GroupMember[];
  agents: GroupMember[];
  campaign_count: number;
}

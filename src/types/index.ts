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
}

export interface Contact {
  id: number;
  phone_number: string;
  name: string | null;
  email: string | null;
  company: string | null;
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

import { query, queryOne } from './db';
import { fail } from './api';
import { logAudit } from './audit';
import { csvCell } from './csv';
import { normFieldName, composeListFields } from './listFields';

/**
 * Campaign results export: ONE ROW PER LEAD, so the file can be filtered and
 * uploaded straight into a new list to target those customers again.
 *
 *   columns = what was uploaded (only the columns that actually hold data)
 *           + what happened     (disposition, reason, notes, talk, agents, …)
 *
 * The upload reads "Mobile No" as the dialed number, stores columns matching
 * the new list's fields and reports the rest as ignored, so nothing here has
 * to be removed before re-uploading.
 */

export interface ExportLead {
  id: number;
  list_name: string | null;
  phone_number: string;
  name: string | null;
  email: string | null;
  company: string | null;
  custom_fields: unknown;
  call_status: string;
  last_disposition: string | null;
  next_retry_at: string | null;
}

/** One calls row, joined to its note — a call with two notes appears twice. */
export interface ExportCall {
  id: number;
  csv_data_id: number | null;
  phone_number: string;
  status: string;
  duration_seconds: number;
  started_at: string | null;
  hangup_cause: string | null;
  disposition: string | null;
  disposition_reason: string | null;
  recording_url: string | null;
  agent: string | null;
  note: string | null;
  note_at: string | null;
}

interface LeadOutcome {
  attempts: number;
  connected: number;
  talkSeconds: number;
  lastCallId: number;
  lastStatus: string;
  lastCallAt: string;
  lastHangup: string;
  lastRecording: string;
  disposition: string;
  reason: string;
  amount: string;
  payDate: string;
  payMode: string;
  dispositionAgent: string;
  agents: Set<string>;
  lastNote: string;
  notes: string[];
}

const OUTCOME_COLUMNS = [
  'List',
  'Lead Status',
  'Disposition',
  'Disposition Reason',
  'Payment Amount',
  'Payment Date',
  'Payment Mode',
  'Call Note',
  'All Notes',
  'Dial Attempts',
  'Connected Calls',
  'Talk Minutes',
  'Talk Time',
  'Disposition Agent',
  'All Agents',
  'Last Call Result',
  'Last Call Time',
  'Last Hangup Cause',
  'Next Retry At',
  'Callback At',
  'Last Recording',
];

/** The uploaded values of a lead as [column, value] pairs, empties dropped. */
function uploadedValues(lead: ExportLead): [string, string][] {
  let raw: unknown = lead.custom_fields;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  // Ordered [column, value] pairs now; a plain object on older uploads.
  const custom: [unknown, unknown][] = Array.isArray(raw)
    ? (raw as [unknown, unknown][])
    : raw && typeof raw === 'object'
      ? Object.entries(raw)
      : [];
  const pairs: [string, string][] = [
    ['Customer Name', lead.name ?? ''],
    ['Mobile No', lead.phone_number],
    ['Email', lead.email ?? ''],
    ['Company', lead.company ?? ''],
  ];
  for (const [k, v] of custom) pairs.push([String(k ?? ''), String(v ?? '')]);
  return pairs
    .map(([k, v]): [string, string] => [k.trim(), v.trim()])
    .filter(([k, v]) => k !== '' && v !== '');
}

/**
 * Split a saved wrap-up note into what the agent typed and the line the Dialer
 * appends to it: "[PTP - Promise to Pay | amt:500 date:2026-11-05 mode:UPI]".
 */
export function parseNote(note: string | null) {
  const text = (note ?? '').trim();
  const m = text.match(/\[([^\[\]]*)\]\s*$/);
  if (!m) return { text, code: '', reason: '', amount: '', payDate: '', payMode: '' };
  const [head, pay = ''] = m[1].split(' | ');
  const sep = head.indexOf(' - ');
  const val = (s: string) => (s === '?' ? '' : s);
  return {
    text: text.slice(0, m.index).trim(),
    code: (sep < 0 ? head : head.slice(0, sep)).trim(),
    reason: sep < 0 ? '' : head.slice(sep + 3).trim(),
    amount: val(pay.match(/amt:(\S*)/)?.[1] ?? ''),
    payDate: val(pay.match(/date:(\S*)/)?.[1] ?? ''),
    payMode: val(pay.match(/mode:(.*)$/)?.[1]?.trim() ?? ''),
  };
}

/** Roll every attempt up onto its lead. `calls` must be oldest first. */
function summarizeCalls(leads: ExportLead[], calls: ExportCall[]): Map<number, LeadOutcome> {
  const leadIds = new Set(leads.map((l) => l.id));
  // A call saved without a lead id still belongs to that number's lead.
  const byPhone = new Map<string, number>();
  for (const l of leads) if (!byPhone.has(l.phone_number)) byPhone.set(l.phone_number, l.id);

  const out = new Map<number, LeadOutcome>();
  for (const c of calls) {
    const leadId =
      c.csv_data_id != null && leadIds.has(c.csv_data_id)
        ? c.csv_data_id
        : byPhone.get(c.phone_number);
    if (leadId == null) continue;

    let o = out.get(leadId);
    if (!o) {
      o = {
        attempts: 0, connected: 0, talkSeconds: 0, lastCallId: 0, lastStatus: '',
        lastCallAt: '', lastHangup: '', lastRecording: '', disposition: '', reason: '',
        amount: '', payDate: '', payMode: '', dispositionAgent: '',
        agents: new Set(), lastNote: '', notes: [],
      };
      out.set(leadId, o);
    }

    // Count the attempt once however many notes it carries.
    if (c.id !== o.lastCallId) {
      o.lastCallId = c.id;
      o.attempts += 1;
      if (c.status === 'connected' || c.status === 'completed') o.connected += 1;
      o.talkSeconds += Number(c.duration_seconds) || 0;
      o.lastStatus = c.status;
      o.lastCallAt = c.started_at ?? '';
      o.lastHangup = c.hangup_cause ?? '';
      if (c.recording_url) o.lastRecording = c.recording_url;
    }
    if (c.agent) o.agents.add(c.agent);

    const note = parseNote(c.note);
    const code = c.disposition || note.code;
    // A later unanswered attempt must not wipe the customer's last disposition.
    if (code) {
      o.disposition = code;
      o.reason = c.disposition_reason || note.reason;
      o.amount = note.amount;
      o.payDate = note.payDate;
      o.payMode = note.payMode;
      o.dispositionAgent = c.agent ?? '';
    }
    if (note.text) {
      const flat = note.text.replace(/\s+/g, ' ');
      o.lastNote = flat;
      o.notes.push(`${c.note_at ?? c.started_at ?? ''} ${c.agent ?? ''}: ${flat}`.trim());
    }
  }
  return out;
}

function fmtTalk(totalSeconds: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${pad(h)}:${pad(m)}:${pad(totalSeconds % 60)}`;
}

/** The whole file. Pure, so the column rules can be checked without a database. */
export function buildCampaignCsv(
  listFields: string[],
  leads: ExportLead[],
  calls: ExportCall[],
  callbacks: Map<number, string>,
): string {
  const values = new Map<number, Map<string, string>>();
  // match key -> header, first spelling wins. The two an upload needs are always
  // there, even for a campaign with no leads left.
  const seen = new Map<string, string>([
    [normFieldName('Customer Name'), 'Customer Name'],
    [normFieldName('Mobile No'), 'Mobile No'],
  ]);
  for (const lead of leads) {
    const row = new Map<string, string>();
    for (const [k, v] of uploadedValues(lead)) {
      const key = normFieldName(k);
      if (!seen.has(key)) seen.set(key, k);
      if (!row.has(key)) row.set(key, v);
    }
    values.set(lead.id, row);
  }

  // The list's own column order, then anything else the data carried.
  const keys: string[] = [];
  const headers: string[] = [];
  const addColumn = (key: string, label: string) => {
    if (!seen.has(key) || keys.includes(key)) return;
    keys.push(key);
    headers.push(label);
  };
  for (const f of listFields) addColumn(normFieldName(f), f);
  for (const [key, label] of Array.from(seen)) addColumn(key, label);

  const outcomes = summarizeCalls(leads, calls);
  const lines = [[...headers, ...OUTCOME_COLUMNS].map(csvCell).join(',')];
  for (const lead of leads) {
    const row = values.get(lead.id)!;
    const o = outcomes.get(lead.id);
    const talk = o?.talkSeconds ?? 0;
    const cells: unknown[] = [
      ...keys.map((k) => row.get(k) ?? ''),
      lead.list_name ?? '',
      lead.call_status,
      o?.disposition || lead.last_disposition || '',
      o?.reason ?? '',
      o?.amount ?? '',
      o?.payDate ?? '',
      o?.payMode ?? '',
      o?.lastNote ?? '',
      o?.notes.join(' | ') ?? '',
      o?.attempts ?? 0,
      o?.connected ?? 0,
      (talk / 60).toFixed(2),
      fmtTalk(talk),
      o?.dispositionAgent ?? '',
      o ? Array.from(o.agents).join(', ') : '',
      o?.lastStatus ?? '',
      o?.lastCallAt ?? '',
      o?.lastHangup ?? '',
      lead.next_retry_at ?? '',
      callbacks.get(lead.id) ?? '',
      o?.lastRecording ?? '',
    ];
    lines.push(cells.map(csvCell).join(','));
  }
  // The BOM makes Excel read names in Hindi as UTF-8; the upload ignores it.
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** The download itself. Callers have already checked who may read this campaign. */
export async function campaignExportResponse(campaignId: number, userId: number): Promise<Response> {
  const campaign = await queryOne<{ name: string; today: string }>(
    `SELECT name, DATE_FORMAT(NOW(), '%Y-%m-%d') AS today FROM campaigns WHERE id = ?`,
    [campaignId],
  );
  if (!campaign) return fail('Campaign not found', 404);

  const lists = await query<{ fields: unknown }>(
    'SELECT fields FROM lists WHERE campaign_id = ? ORDER BY id',
    [campaignId],
  );
  const listFields = lists.flatMap((l) => {
    let raw = l.fields;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }
    return composeListFields(Array.isArray(raw) ? (raw as string[]) : null);
  });

  const leads = await query<ExportLead>(
    `SELECT d.id, l.name AS list_name, d.phone_number, d.name, d.email, d.company,
            d.custom_fields, d.call_status, d.last_disposition,
            DATE_FORMAT(d.next_retry_at, '%Y-%m-%d %H:%i:%s') AS next_retry_at
       FROM csv_data d
       LEFT JOIN lists l ON l.id = d.list_id
      WHERE d.campaign_id = ?
      ORDER BY d.id`,
    [campaignId],
  );

  const calls = await query<ExportCall>(
    `SELECT c.id, c.csv_data_id, c.phone_number, c.status, c.duration_seconds,
            DATE_FORMAT(c.started_at, '%Y-%m-%d %H:%i:%s') AS started_at,
            c.hangup_cause, COALESCE(c.disposition, n.tags) AS disposition,
            c.disposition_reason, c.recording_url, u.name AS agent, n.note,
            DATE_FORMAT(n.created_at, '%Y-%m-%d %H:%i:%s') AS note_at
       FROM calls c
       LEFT JOIN users u ON u.id = c.employee_id
       LEFT JOIN call_notes n ON n.call_id = c.id
      WHERE c.campaign_id = ?
      ORDER BY c.id, n.id`,
    [campaignId],
  );

  const pending = await query<{ csv_data_id: number; at: string }>(
    `SELECT csv_data_id, DATE_FORMAT(MIN(scheduled_at), '%Y-%m-%d %H:%i:%s') AS at
       FROM scheduled_calls
      WHERE campaign_id = ? AND status = 'pending' AND csv_data_id IS NOT NULL
      GROUP BY csv_data_id`,
    [campaignId],
  );
  const callbacks = new Map(pending.map((p) => [p.csv_data_id, p.at]));

  await logAudit({
    userId,
    action: 'export_campaign',
    entity: 'campaigns',
    entityId: campaignId,
    details: { name: campaign.name, leads: leads.length },
  });

  const slug = campaign.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || `campaign-${campaignId}`;
  return new Response(buildCampaignCsv(listFields, leads, calls, callbacks), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-${campaign.today}.csv"`,
    },
  });
}

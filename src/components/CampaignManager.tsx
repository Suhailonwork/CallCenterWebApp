"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import type {
  CampaignRow,
  DialerType,
  DispositionAction,
  DispositionRuleOverride,
  DupMode,
  ListRow,
  RecycleRule,
} from "@/types";
import type { GsmGateway } from "./GatewayManager";
import { FieldsEditor } from "./FieldsEditor";
import { DEFAULT_LIST_FIELDS } from "@/lib/listFields";
import {
  DISPOSITION_CATALOG,
  describeRule,
  parseDispositionRules,
  resolveDisposition,
} from "@/lib/dispositionRules";
import {
  describeMode,
  isPredictive,
  labelFor,
  modeOwnsPacingField,
  normalizeMode,
} from "@/lib/dialerModes";

const DIALER_OPTIONS: {
  value: DialerType;
  label: string;
  desc: string;
  color: string;
}[] = [
  {
    value: "predictive",
    label: "Predictive",
    desc: "Auto-dials ahead of agent availability",
    color: "bg-blue-100 text-blue-700",
  },
  {
    value: "manual",
    label: "Manual",
    desc: "Agent dials each contact manually",
    color: "bg-slate-100 text-slate-700",
  },
  {
    value: "inbound",
    label: "Inbound",
    desc: "Receives incoming calls",
    color: "bg-green-100 text-green-700",
  },
  {
    value: "ratio",
    label: "Ratio",
    desc: "Dials at a fixed agent:call ratio",
    color: "bg-amber-100 text-amber-700",
  },
];

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-slate-100 text-slate-600",
};

// The lead lifecycle statuses (src/lib/leadStatus.js). Used for the
// dial_statuses multi-select and the recycle-rules editor. Statuses compare
// case-insensitively in MySQL, so campaigns saved with the older lowercase
// spellings keep working — normStatus() just tidies them up for display.
const LEAD_STATUSES: { value: string; label: string; terminal?: boolean }[] = [
  { value: "NEW", label: "NEW (never called)" },
  { value: "NO_ANSWER", label: "No Answer (NA)" },
  { value: "BUSY", label: "Busy (B)" },
  { value: "FAILED", label: "Failed / Congestion" },
  { value: "VOICEMAIL", label: "Voicemail / Machine" },
  { value: "CANCELLED", label: "Cancelled / Abandoned" },
  { value: "CALLBACK", label: "Callback due" },
  { value: "WRONG_NUMBER", label: "Wrong Number", terminal: true },
  { value: "CONNECTED", label: "Connected (talked)", terminal: true },
  { value: "COMPLETED", label: "Completed (final)", terminal: true },
];

const DEFAULT_DIAL_STATUSES = ["NEW", "NO_ANSWER", "BUSY"];

const LEAD_ORDERS: { value: string; label: string }[] = [
  { value: "oldest", label: "Oldest first (FIFO)" },
  { value: "newest", label: "Newest first" },
  { value: "priority", label: "Least recently called" },
  { value: "random", label: "Random" },
];

/** Older campaigns stored "no_answer"; the editor works in UPPERCASE. */
function normStatus(v: unknown): string {
  return String(v ?? "").trim().toUpperCase();
}

function parseJsonField<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

interface DialableReport {
  dialable: number;
  totalLeads: number;
  maxAttempts: number;
  activeLists: { id: number; name: string; leads: number }[];
  inactiveLists: { id: number; name: string; leads: number }[];
  gateways: { id: number; name: string; usable: boolean; reason: string | null }[];
  blockers: { reason: string; count: number; detail: string; action: string }[];
}

type CampaignWithGateways = CampaignRow & { gateways?: GsmGateway[] };

interface GroupOption {
  id: number;
  name: string;
}

/**
 * Campaign console, shared by Admin and TL.
 *   - Admin (default): apiBase="/api/admin", consoleBase="/admin", group optional.
 *   - TL: apiBase="/api/tl", consoleBase="/tl" — the TL API only returns/accepts
 *     campaigns in the TL's groups, and a group is required when creating.
 * Gateways are always read from the admin endpoints (TLs have read access).
 */
export function CampaignManager({
  apiBase = "/api/admin",
  consoleBase = "/admin",
  requireGroup = false,
}: {
  apiBase?: string;
  consoleBase?: string;
  requireGroup?: boolean;
} = {}) {
  const [campaigns, setCampaigns] = useState<CampaignWithGateways[]>([]);
  const [allGateways, setAllGateways] = useState<GsmGateway[]>([]);
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);
  const [groupId, setGroupId] = useState<number | "">("");
  const [gwStatus, setGwStatus] = useState<
    Record<number, { reachable: boolean; state: string }>
  >({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [script, setScript] = useState("");
  const [dialerType, setDialerType] = useState<DialerType>("manual");
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [selectedGatewayIds, setSelectedGatewayIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  // Upload-CSV modal: a CSV always lands in a LIST of the campaign.
  const [uploadFor, setUploadFor] = useState<CampaignWithGateways | null>(null);
  const [uploadLists, setUploadLists] = useState<ListRow[]>([]);
  const [uploadListId, setUploadListId] = useState<number | "new">("new");
  const [newListName, setNewListName] = useState("");
  const [newListFields, setNewListFields] = useState<string[]>([...DEFAULT_LIST_FIELDS]);
  const [dupMode, setDupMode] = useState<DupMode>("none");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  // Edit-gateway modal for an existing campaign
  const [editGwFor, setEditGwFor] = useState<CampaignWithGateways | null>(null);
  const [editGwIds, setEditGwIds] = useState<number[]>([]);
  // Dial-rules modal (dial_statuses multi-select + recycle rules editor)
  const [rulesFor, setRulesFor] = useState<CampaignWithGateways | null>(null);
  const [selStatuses, setSelStatuses] = useState<string[]>(DEFAULT_DIAL_STATUSES);
  const [recycleRules, setRecycleRules] = useState<RecycleRule[]>([]);
  // Overrides of the disposition rules; a code with no entry keeps its default.
  const [dispoRules, setDispoRules] = useState<Record<string, DispositionRuleOverride>>({});
  const [dispoOpen, setDispoOpen] = useState(false);
  const [rulesBusy, setRulesBusy] = useState(false);
  // The mode of the campaign whose rules are open. Pacing controls follow it:
  // the mode decides which settings exist at all, and the API refuses the rest.
  const rulesMode = normalizeMode(rulesFor?.dialer_type);
  // Pacing knobs, edited in the same modal as the dial rules.
  const [dialRatio, setDialRatio] = useState(1);
  const [maxAttempts, setMaxAttempts] = useState(0);
  const [dialTimeout, setDialTimeout] = useState(45);
  const [wrapupSeconds, setWrapupSeconds] = useState(0);
  // "What will actually dial right now" — computed by the engine's own
  // predicate so the modal can never disagree with the dialer.
  const [diag, setDiag] = useState<DialableReport | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);
  const diagReq = useRef(0);
  const [leadOrder, setLeadOrder] = useState("oldest");
  const [callbacksOn, setCallbacksOn] = useState(true);
  const [maxAbandon, setMaxAbandon] = useState(3);
  // Monotonic token so a slow openUpload response can't repopulate the modal
  // after the user has switched to a different campaign.
  const uploadReq = useRef(0);
  const router = useRouter();
  async function load() {
    setLoading(true);
    try {
      const [campRes, gwRes, statusRes, grpRes] = await Promise.all([
        fetch(`${apiBase}/campaigns`),
        fetch("/api/admin/gateways"),
        fetch("/api/admin/gateways/status"),
        fetch(`${apiBase}/groups`),
      ]);
      const campData = await campRes.json().catch(() => ({}));
      const gwData = await gwRes.json().catch(() => ({}));
      const statusData = await statusRes.json().catch(() => ({}));
      const grpData = await grpRes.json().catch(() => ({}));
      if (campRes.ok) setCampaigns(campData.campaigns ?? []);
      else toast.error(campData.error ?? "Failed to load campaigns");
      if (gwRes.ok) setAllGateways(gwData.gateways ?? []);
      if (statusRes.ok) setGwStatus(statusData.status ?? {});
      if (grpRes.ok) setGroupOptions(grpData.groups ?? []);
    } catch {
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleGateway(
    id: number,
    list: number[],
    setList: (v: number[]) => void,
  ) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function create() {
    if (!name.trim()) {
      toast.warning("Campaign name is required");
      return;
    }
    if (requireGroup && groupId === "") {
      toast.warning("Select the group this campaign belongs to");
      return;
    }
    if (selectedGatewayIds.length === 0) {
      toast.warning("Select at least one GSM gateway for this campaign");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          script: script || null,
          dialer_type: dialerType,
          gatewayIds: selectedGatewayIds,
          recording_enabled: recordingEnabled,
          group_id: groupId === "" ? null : groupId,
          // Campaign = rules only (VICIdial-style). The data template is a
          // LIST concern now — picked when a list is created / uploaded.
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create campaign");
        return;
      }
      toast.success(
        selectedGatewayIds.length > 0
          ? `Campaign created with ${selectedGatewayIds.length} gateway(s)`
          : "Campaign created",
      );
      setName("");
      setDescription("");
      setScript("");
      setDialerType("manual");
      setSelectedGatewayIds([]);
      setRecordingEnabled(false);
      setGroupId("");
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function updateCampaignGateways() {
    if (!editGwFor) return;
    const cleanIds = editGwIds.filter((id) => Number.isInteger(id) && id > 0);
    if (cleanIds.length === 0) {
      toast.warning("A campaign must keep at least one GSM gateway");
      return;
    }
    const res = await fetch(`${apiBase}/campaigns/${editGwFor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gatewayIds: cleanIds }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success("Gateways updated");
      setEditGwFor(null);
      load();
    } else {
      toast.error(data.error ?? "Update failed");
      console.error("[updateCampaignGateways]", res.status, data);
    }
  }

  function openRules(c: CampaignWithGateways) {
    setRulesFor(c);
    setSelStatuses(
      parseJsonField<string[]>(c.dial_statuses, DEFAULT_DIAL_STATUSES).map(normStatus),
    );
    setRecycleRules(
      parseJsonField<RecycleRule[]>(c.recycle_rules, []).map((r) => ({
        ...r,
        status: normStatus(r.status),
      })),
    );
    setDispoRules(parseDispositionRules(c.disposition_rules));
    setDispoOpen(false);
    setDialRatio(Number(c.dial_ratio ?? 1) || 1);
    setMaxAttempts(Number(c.retry_count ?? 0) || 0);
    setDialTimeout(Number(c.dial_timeout_sec ?? 45) || 45);
    setWrapupSeconds(Number(c.wrapup_seconds ?? 0) || 0);
    setLeadOrder(String(c.lead_order ?? "oldest"));
    setCallbacksOn(Number(c.callbacks_enabled ?? 1) === 1);
    setMaxAbandon(Number(c.max_abandon_pct ?? 3) || 3);
    setDiag(null); // the effect below evaluates the rules just loaded
  }

  /* ---- disposition rules: the default is the catalogue, and only what the
   *      operator actually changes is stored as an override. ---- */

  /** The rule a code produces with the overrides currently in the editor. */
  function dispoRuleFor(code: string) {
    return resolveDisposition({ code, overrides: dispoRules })!;
  }

  /** The rule the same code produces with no overrides at all. */
  function dispoDefaultFor(code: string) {
    return resolveDisposition({ code })!;
  }

  function setDispoField(
    code: string,
    field: "action" | "delay_min" | "max_attempts",
    value: DispositionAction | number | null,
  ) {
    setDispoRules((prev) => {
      const next: Record<string, DispositionRuleOverride> = { ...prev };
      const entry: DispositionRuleOverride = { ...(prev[code] ?? {}) };
      const fallback = dispoDefaultFor(code) as unknown as Record<string, unknown>;
      // Back to the catalogue value = no override at all, so the campaign keeps
      // following the default if it ever changes.
      if (value === null || value === fallback[field]) delete entry[field];
      else (entry as Record<string, unknown>)[field] = value;
      if (Object.keys(entry).length === 0) delete next[code];
      else next[code] = entry;
      return next;
    });
  }

  // Re-evaluate "what can dial" whenever the rules in the editor change, so the
  // count always describes the configuration on screen instead of the one last
  // saved. Debounced, and loadDiag() drops out-of-order replies.
  useEffect(() => {
    if (!rulesFor) return;
    const campaignId = rulesFor.id;
    const t = setTimeout(() => {
      loadDiag(campaignId, {
        dial_statuses: selStatuses,
        // Half-typed rows would fail validation and blank the panel mid-edit.
        recycle_rules: recycleRules.filter(
          (r) => r.status && Number(r.delay_min) >= 1 && Number(r.max_attempts) >= 1,
        ),
        disposition_rules: Object.keys(dispoRules).length > 0 ? dispoRules : null,
        retry_count: Number(maxAttempts) || 0,
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rulesFor, selStatuses, recycleRules, dispoRules, maxAttempts]);

  /**
   * Ask the server what the dialer could claim. `pending` sends the rules
   * currently in the editor so the count answers "what would dial if I saved
   * this?" — the server evaluates them with the engine's own claim predicate,
   * so the number on screen and the engine's lead selection always agree.
   */
  async function loadDiag(
    campaignId: number,
    pending?: {
      dial_statuses: string[];
      recycle_rules: RecycleRule[];
      disposition_rules: Record<string, DispositionRuleOverride> | null;
      retry_count: number;
    },
  ) {
    const seq = ++diagReq.current;
    setDiagBusy(true);
    try {
      const url = `${apiBase}/campaigns/${campaignId}/dialable`;
      const res = pending
        ? await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dial_statuses: pending.dial_statuses,
              recycle_rules: pending.recycle_rules.map((r) => ({
                status: r.status,
                delay_min: Number(r.delay_min),
                max_attempts: Number(r.max_attempts),
              })),
              disposition_rules: pending.disposition_rules,
              retry_count: Number(pending.retry_count) || 0,
            }),
          })
        : await fetch(url);
      const data = await res.json().catch(() => null);
      if (seq !== diagReq.current) return; // a newer edit already superseded this
      if (res.ok && data) setDiag(data);
    } catch {
      /* the panel is advisory — never block the modal on it */
    } finally {
      if (seq === diagReq.current) setDiagBusy(false);
    }
  }

  /** Reset a list straight from the dial-rules modal — this is the action the
   *  "already called" blocker almost always needs. */
  async function resetListInline(listId: number, listName: string) {
    if (
      !window.confirm(
        `Reset "${listName}"?\n\nEvery lead becomes fresh again (call counters ` +
          `and retry timers cleared). Statuses and call history are kept.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/lists/${listId}/reset`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.error ?? "Reset failed");
      toast.success(`"${listName}" reset — ${data.dialableAfter ?? 0} leads dialable again`);
      if (rulesFor) loadDiag(rulesFor.id);
      load();
    } catch {
      toast.error("Network error");
    }
  }

  async function saveRules() {
    if (!rulesFor) return;
    // NaN-safe validation: `NaN < 1` is false, so guard on the positive side.
    for (const r of recycleRules) {
      if (
        !r.status ||
        !(Number(r.delay_min) >= 1 && Number(r.delay_min) <= 10080) ||
        !(Number(r.max_attempts) >= 1 && Number(r.max_attempts) <= 50)
      ) {
        toast.warning(
          "Every recycle rule needs a status, delay 1–10080 min and 1–50 attempts",
        );
        return;
      }
    }
    // Nothing to dial guard: no dial status AND no recycle rule.
    if (selStatuses.length === 0 && recycleRules.length === 0) {
      toast.warning(
        "Select at least one dial status or add a recycle rule — otherwise nothing will dial",
      );
      return;
    }
    if (
      modeOwnsPacingField(rulesMode, "dial_ratio") &&
      !(Number(dialRatio) >= 1 && Number(dialRatio) <= 10)
    ) {
      toast.warning(
        isPredictive(rulesMode)
          ? "Max lines per agent must be between 1.0 and 10.0"
          : "Lines per ready agent must be between 1.0 and 10.0",
      );
      return;
    }
    if (!(Number(maxAttempts) >= 0 && Number(maxAttempts) <= 100)) {
      toast.warning("Max attempts must be between 0 (unlimited) and 100");
      return;
    }
    if (!(Number(dialTimeout) >= 10 && Number(dialTimeout) <= 180)) {
      toast.warning("Ring timeout must be between 10 and 180 seconds");
      return;
    }
    setRulesBusy(true);
    try {
      const res = await fetch(`${apiBase}/campaigns/${rulesFor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dial_statuses: selStatuses,
          // Coerce to plain numbers in case an input left a string/empty value.
          recycle_rules: recycleRules.map((r) => ({
            status: r.status,
            delay_min: Number(r.delay_min),
            max_attempts: Number(r.max_attempts),
          })),
          // NULL = follow the catalogue defaults for every disposition.
          disposition_rules: Object.keys(dispoRules).length > 0 ? dispoRules : null,
          retry_count: Number(maxAttempts),
          dial_timeout_sec: Number(dialTimeout),
          lead_order: leadOrder,
          callbacks_enabled: callbacksOn,
          // Pacing goes only to the modes that own it. Sending dial_ratio for
          // a manual campaign is not merely useless — the API rejects the whole
          // request, which is the behaviour we want when the two disagree.
          ...(modeOwnsPacingField(rulesMode, "dial_ratio")
            ? { dial_ratio: Number(dialRatio) }
            : {}),
          ...(modeOwnsPacingField(rulesMode, "max_abandon_pct")
            ? { max_abandon_pct: Number(maxAbandon) }
            : {}),
          ...(modeOwnsPacingField(rulesMode, "wrapup_seconds")
            ? { wrapup_seconds: Number(wrapupSeconds) }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.error ?? "Update failed");
      toast.success(
        data.dialerRestarted
          ? "Dial rules saved — dialer restarted with the new rules"
          : "Dial rules saved — the dialer applies them within ~2s",
      );
      load();
      // Re-check against the new rules. If the campaign still cannot dial, stay
      // open showing why — that is the feedback loop the operator needs.
      const res2 = await fetch(`${apiBase}/campaigns/${rulesFor.id}/dialable`);
      const after: DialableReport | null = await res2.json().catch(() => null);
      if (res2.ok && after && after.dialable === 0 && after.totalLeads > 0) {
        setDiag(after);
        return;
      }
      setRulesFor(null);
    } finally {
      setRulesBusy(false);
    }
  }

  async function setStatus(id: number, status: string) {
    const res = await fetch(`${apiBase}/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success("Campaign updated");
      load();
    } else {
      toast.error("Update failed");
    }
  }

  async function deleteCampaign(c: CampaignWithGateways) {
    const leads = Number(c.total_contacts) || 0;
    if (
      !window.confirm(
        `Delete campaign "${c.name}"? This also deletes its lists and ${leads} leads, ` +
          `and unassigns its agents & gateways. Call history is kept. This cannot be undone.`,
      )
    )
      return;
    const res = await fetch(`${apiBase}/campaigns/${c.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return void toast.error(data.error ?? "Delete failed");
    toast.success(
      `Campaign deleted (${data.deletedLists ?? 0} lists, ${data.deletedLeads ?? 0} leads removed)`,
    );
    load();
  }

  async function openUpload(c: CampaignWithGateways) {
    const seq = ++uploadReq.current;
    setUploadFor(c);
    setUploadFile(null);
    setDupMode("none");
    setNewListName("");
    setNewListFields([...DEFAULT_LIST_FIELDS]);
    setUploadLists([]);
    setUploadListId("new");
    const res = await fetch(`${apiBase}/lists?campaignId=${c.id}`);
    const data = await res.json().catch(() => ({}));
    // Ignore a response that lost the race to a newer openUpload().
    if (seq !== uploadReq.current) return;
    if (res.ok) {
      const lists: ListRow[] = data.lists ?? [];
      setUploadLists(lists);
      if (lists.length > 0) setUploadListId(lists[0].id);
    } else {
      toast.error(data.error ?? "Failed to load lists");
    }
  }

  async function submitUpload() {
    if (!uploadFor || !uploadFile) {
      toast.warning("Choose a CSV file first");
      return;
    }
    if (uploadListId === "new" && !newListName.trim()) {
      toast.warning("Name the new list");
      return;
    }
    setUploadBusy(true);
    try {
      let listId = uploadListId;
      if (listId === "new") {
        const cleanFields = newListFields.map((f) => f.trim()).filter(Boolean);
        const res = await fetch(`${apiBase}/lists`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newListName.trim(),
            campaign_id: uploadFor.id,
            fields: cleanFields.length > 0 ? cleanFields : null,
            active: "Y",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error ?? "Failed to create list");
          return;
        }
        listId = data.id;
        // Pin the modal to the list we just created and add it to the picker,
        // so a retry after a failed upload reuses it instead of creating a
        // second identically-named orphan list.
        setUploadListId(data.id);
        setUploadLists((ls) => [
          ...ls,
          {
            id: data.id,
            name: newListName.trim(),
            description: null,
            campaign_id: uploadFor.id,
            campaign_name: uploadFor.name,
            active: "Y",
            fields: cleanFields.length > 0 ? cleanFields : null,
            created_at: "",
            lead_count: 0,
            fresh_count: 0,
          },
        ]);
      }
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("dupMode", dupMode);
      const res = await fetch(`${apiBase}/lists/${listId}/contacts`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      toast.success(
        `Imported ${data.imported} leads` +
          (data.skippedDuplicates > 0
            ? ` (${data.skippedDuplicates} duplicates skipped)`
            : ""),
      );
      const ignored: string[] = data.ignoredColumns ?? [];
      if (ignored.length > 0) {
        toast.warning(
          `Ignored ${ignored.length} unmatched column(s): ${ignored.join(", ")}. ` +
            `Add them as custom fields on the list first if you need them.`,
          { autoClose: 8000 },
        );
      }
      setUploadFor(null);
      load();
    } catch {
      toast.error("Upload failed — check your connection and try again");
    } finally {
      setUploadBusy(false);
    }
  }

  // Outcome statuses a call can actually land on that have no recycle rule — a
  // lead reaching one of these is dialled once and then never again. This is
  // the most common reason a campaign quietly "stops calling".
  // Ordinary call outcomes an operator expects to retry. Statuses that are
  // usually final (CONNECTED, WRONG_NUMBER, COMPLETED) are left out on purpose:
  // they *can* carry a recycle rule, but having none is the normal case, so
  // warning about them would be noise.
  const RETRYABLE_OUTCOMES = ["NO_ANSWER", "BUSY", "FAILED", "VOICEMAIL", "CANCELLED"];
  const deadEndStatuses = RETRYABLE_OUTCOMES.filter(
    (s) => !recycleRules.some((r) => normStatus(r.status) === s),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Campaigns</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "+ New campaign"}
        </button>
      </div>

      {/* ── Create campaign form ── */}
      {showForm && (
        <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Call script
            </label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {/* ── Group ownership ── */}
          {(groupOptions.length > 0 || requireGroup) && (
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Group
                {!requireGroup && (
                  <span className="ml-1 text-xs text-slate-400">(optional)</span>
                )}
              </label>
              <select
                value={groupId}
                onChange={(e) =>
                  setGroupId(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">
                  {requireGroup ? "Select a group…" : "No group (admin only)"}
                </option>
                {groupOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              {requireGroup && groupOptions.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  You are not assigned to any group yet — ask an admin.
                </p>
              )}
            </div>
          )}

          {/* Data template is chosen per LIST (on upload / in Lists), not on
              the campaign — VICIdial-style: campaign = rules, list = data. */}

          {/* ── Dialer type ── */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Dialer type
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DIALER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDialerType(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    dialerType === opt.value
                      ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-semibold">{opt.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500 leading-tight">
                    {opt.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Gateway multi-select ── */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              GSM Gateways
              <span className="ml-1 text-xs text-slate-400">
                (select one or more)
              </span>
            </label>
            {allGateways.length === 0 ? (
              <p className="mt-1 text-xs text-slate-400">
                No gateways configured — add one in the Gateways tab first.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {allGateways.map((gw) => {
                  const checked = selectedGatewayIds.includes(gw.id);
                  return (
                    <label
                      key={gw.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        checked
                          ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                          : "border-slate-200 hover:bg-slate-50"
                      } ${gw.status === "inactive" ? "opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={gw.status === "inactive"}
                        onChange={() =>
                          toggleGateway(
                            gw.id,
                            selectedGatewayIds,
                            setSelectedGatewayIds,
                          )
                        }
                        className="accent-indigo-600"
                      />
                      <span className="flex-1 truncate font-medium">
                        {gw.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {gw.channels}ch
                      </span>
                      {gwStatus[gw.id] ? (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                            gwStatus[gw.id].reachable
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {gwStatus[gw.id].reachable ? "● Online" : "● Offline"}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-400">
                          ● Unknown
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            {selectedGatewayIds.length > 0 && (
              <p className="mt-1 text-xs text-indigo-600 font-medium">
                {selectedGatewayIds.length} gateway(s) selected — total{" "}
                {allGateways
                  .filter((g) => selectedGatewayIds.includes(g.id))
                  .reduce((s, g) => s + g.channels, 0)}{" "}
                channels
              </p>
            )}
          </div>

          {/* ── Recording toggle ── */}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
            <input
              type="checkbox"
              checked={recordingEnabled}
              onChange={(e) => setRecordingEnabled(e.target.checked)}
              className="accent-indigo-600"
            />
            <span className="font-medium text-slate-700">
              Enable call recording
            </span>
            <span className="text-xs text-slate-400">
              — records every call in this campaign
            </span>
          </label>

          <button
            onClick={create}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create campaign"}
          </button>
        </div>
      )}

      {/* ── Campaign list ── */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-slate-400">No campaigns yet.</p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => {
              const total = Number(c.total_contacts);
              const called = Number(c.called_contacts);
              const pct = total > 0 ? Math.round((called / total) * 100) : 0;
              const gws = c.gateways ?? [];
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        onClick={() => router.push(`${consoleBase}/campaigns/${c.id}`)}
                        className="font-semibold text-indigo-600 hover:underline text-left"
                      >
                        {c.name}
                      </button>
                      {c.description && (
                        <p className="text-xs text-slate-500">
                          {c.description}
                        </p>
                      )}
                      {/* Dialer type badge */}
                      {c.dialer_type &&
                        (() => {
                          const opt = DIALER_OPTIONS.find(
                            (o) => o.value === c.dialer_type,
                          );
                          return opt ? (
                            <span
                              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${opt.color}`}
                            >
                              {opt.label} dialer
                            </span>
                          ) : null;
                        })()}
                      {/* Group badge */}
                      {c.group_name && (
                        <span className="mt-1 ml-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          👥 {c.group_name}
                        </span>
                      )}
                      {/* Gateway chips — name · endpoint · live status (from DB/ARI) */}
                      {gws.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {gws.map((gw) => {
                            const online = gwStatus[gw.id]?.reachable;
                            const statusLabel =
                              gw.status === "inactive"
                                ? "● disabled"
                                : online
                                  ? "● online"
                                  : online === false
                                    ? "● offline"
                                    : "● unknown";
                            const statusColor =
                              gw.status === "inactive"
                                ? "text-slate-400"
                                : online
                                  ? "text-green-600"
                                  : online === false
                                    ? "text-red-600"
                                    : "text-slate-400";
                            return (
                              <span
                                key={gw.id}
                                className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700"
                              >
                                📡 {gw.name} ·{" "}
                                <span className="font-mono">gw{gw.id}</span> ·{" "}
                                {gw.channels}ch
                                <span className={statusColor}>{statusLabel}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {gws.length === 0 && (
                        <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                          No gateway assigned
                        </span>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status] ?? ""}`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>
                        {called} / {total} contacts called
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-indigo-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => openUpload(c)}
                      className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                    >
                      Upload CSV
                    </button>
                    <button
                      onClick={() => {
                        setEditGwFor(c);
                        setEditGwIds((c.gateways ?? []).map((g) => g.id));
                      }}
                      className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50"
                    >
                      Edit gateways
                    </button>
                    <button
                      onClick={() => openRules(c)}
                      className="rounded-lg border border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50"
                    >
                      Dial rules
                    </button>
                    {c.status !== "active" && (
                      <button
                        onClick={() => setStatus(c.id, "active")}
                        className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
                      >
                        Activate
                      </button>
                    )}
                    {c.status === "active" && (
                      <button
                        onClick={() => setStatus(c.id, "paused")}
                        className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                      >
                        Pause
                      </button>
                    )}
                    {c.status !== "completed" && (
                      <button
                        onClick={() => setStatus(c.id, "completed")}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                      >
                        Mark completed
                      </button>
                    )}
                    <button
                      onClick={() => deleteCampaign(c)}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        CSV format: a header row with a phone column (<code>phone</code>,{" "}
        <code>Mobile NO</code>, <code>phone_number</code>, …). Every upload
        lands in a List of the campaign; the list&apos;s custom fields decide
        which columns are stored.
      </p>

      {/* ── Upload CSV modal (upload targets a LIST) ── */}
      {uploadFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold">
              Upload CSV — {uploadFor.name}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Leads always belong to a list. Pick one of this campaign&apos;s
              lists or create a new one.
            </p>

            <label className="mt-3 block text-sm font-medium text-slate-700">
              Target list
            </label>
            <select
              value={uploadListId}
              onChange={(e) =>
                setUploadListId(
                  e.target.value === "new" ? "new" : Number(e.target.value),
                )
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {uploadLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.lead_count} leads ·{" "}
                  {l.active === "Y" ? "ON" : "OFF"}
                  {l.fields && l.fields.length > 0 ? ` · ${l.fields.length} fields` : ""}
                </option>
              ))}
              <option value="new">➕ Create a new list…</option>
            </select>

            {uploadListId === "new" && (
              <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    New list name
                  </label>
                  <input
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="e.g. July BX batch"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Custom fields
                    <span className="ml-1 text-slate-400">
                      (optional — leave empty to store all CSV columns)
                    </span>
                  </label>
                  <div className="mt-1">
                    <FieldsEditor fields={newListFields} onChange={setNewListFields} />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  The new list starts ON (dialable) in this campaign.
                </p>
              </div>
            )}

            <label className="mt-3 block text-sm font-medium text-slate-700">
              Duplicate check
            </label>
            <select
              value={dupMode}
              onChange={(e) => setDupMode(e.target.value as DupMode)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="none">No duplicate check (append everything)</option>
              <option value="list">Skip phones already in this list</option>
              <option value="campaign">
                Skip phones in any list of this campaign
              </option>
            </select>

            <label className="mt-3 block text-sm font-medium text-slate-700">
              CSV file
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm"
            />

            <div className="mt-4 flex gap-2">
              <button
                onClick={submitUpload}
                disabled={uploadBusy}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {uploadBusy ? "Uploading…" : "Upload"}
              </button>
              <button
                onClick={() => setUploadFor(null)}
                disabled={uploadBusy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dial rules modal (dial statuses + lead recycle) ── */}
      {rulesFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold">Dial rules — {rulesFor.name}</h2>

            {/* ── What will actually dial right now ── */}
            <div
              className={
                "mt-3 rounded-xl p-3 ring-1 ring-inset " +
                (diagBusy || !diag
                  ? "bg-slate-50 ring-slate-200"
                  : diag.dialable > 0
                    ? "bg-emerald-50 ring-emerald-200"
                    : "bg-amber-50 ring-amber-200")
              }
            >
              {diagBusy || !diag ? (
                <p className="text-xs text-slate-500">Checking what can dial…</p>
              ) : (
                <>
                  <p
                    className={
                      "text-sm font-semibold " +
                      (diag.dialable > 0 ? "text-emerald-800" : "text-amber-800")
                    }
                  >
                    {diag.dialable > 0
                      ? `${diag.dialable} of ${diag.totalLeads} lead${diag.totalLeads === 1 ? "" : "s"} can dial with these rules`
                      : `Nothing can dial with these rules (${diag.totalLeads} lead${diag.totalLeads === 1 ? "" : "s"} in ON lists)`}
                  </p>
                  {diag.blockers.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {diag.blockers.map((b, i) => (
                        <li key={i} className="text-xs text-amber-900">
                          <span className="font-medium">
                            {b.count > 0 ? `${b.count} × ` : ""}
                            {b.reason}
                          </span>
                          <span className="text-amber-700"> — {b.detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* Resetting a list is an admin-only endpoint. */}
                  {diag.dialable === 0 &&
                    diag.activeLists.length > 0 &&
                    apiBase === "/api/admin" && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-amber-800">
                        Make every lead fresh again:
                      </span>
                      {diag.activeLists.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => resetListInline(l.id, l.name)}
                          className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                        >
                          Reset &ldquo;{l.name}&rdquo; ({l.leads})
                        </button>
                      ))}
                      </div>
                    )}
                </>
              )}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Which <b>not-yet-called</b> leads the dialer picks up, from lists
              that are switched ON. A lead is &ldquo;not yet called&rdquo; until
              it is dialled once; after that only a <b>recycle rule</b> below —
              or a list <b>RESET</b> — brings it back. Ticking a box here does
              not re-dial a lead that has already been called.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {LEAD_STATUSES.map((s) => {
                const checked = selStatuses.includes(s.value);
                return (
                  <label
                    key={s.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                      checked
                        ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelStatuses((prev) =>
                          prev.includes(s.value)
                            ? prev.filter((x) => x !== s.value)
                            : [...prev, s.value],
                        )
                      }
                      className="accent-indigo-600"
                    />
                    <span className="font-medium">{s.label}</span>
                  </label>
                );
              })}
            </div>
            {selStatuses.some(
              (v) => LEAD_STATUSES.find((s) => s.value === v)?.terminal,
            ) && (
              <p className="mt-1 text-xs text-amber-600">
                ⚠ Connected / Wrong Number are usually final — including them
                re-dials closed leads after a reset.
              </p>
            )}
            {selStatuses.length === 0 && (
              <p className="mt-1 text-xs text-red-600">
                No statuses selected — this campaign will only dial recycled
                leads (below), nothing fresh.
              </p>
            )}
            {deadEndStatuses.length > 0 && (
              <p className="mt-1 text-xs text-amber-600">
                ⚠ A lead that lands on{" "}
                <b>{deadEndStatuses.join(", ")}</b> stops being dialled — there
                is no recycle rule for it. Add one below to keep retrying.
              </p>
            )}

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  Lead recycle (auto-retry)
                </p>
                <button
                  onClick={() =>
                    setRecycleRules((r) => [
                      ...r,
                      { status: "NO_ANSWER", delay_min: 60, max_attempts: 3 },
                    ])
                  }
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50"
                >
                  + Add rule
                </button>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                This is what keeps calling a lead. Re-dial a status after a
                delay, up to N extra attempts — no list reset needed. A status
                with <b>no rule here stops being dialled</b> the moment a lead
                lands on it.
              </p>
              {recycleRules.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">
                  No recycle rules — leads are only re-dialed after a list RESET.
                </p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {recycleRules.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <select
                        value={r.status}
                        onChange={(e) =>
                          setRecycleRules((rules) =>
                            rules.map((x, j) =>
                              j === i ? { ...x, status: e.target.value } : x,
                            ),
                          )
                        }
                        className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5"
                      >
                        {LEAD_STATUSES.filter((s) => s.value !== "NEW").map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1">
                        after
                        <input
                          type="number"
                          min={1}
                          value={r.delay_min}
                          onChange={(e) =>
                            setRecycleRules((rules) =>
                              rules.map((x, j) =>
                                j === i
                                  ? { ...x, delay_min: Number(e.target.value) }
                                  : x,
                              ),
                            )
                          }
                          className="w-16 rounded-lg border border-slate-300 px-2 py-1.5"
                        />
                        min
                      </label>
                      <label className="flex items-center gap-1">
                        max
                        <input
                          type="number"
                          min={1}
                          value={r.max_attempts}
                          onChange={(e) =>
                            setRecycleRules((rules) =>
                              rules.map((x, j) =>
                                j === i
                                  ? { ...x, max_attempts: Number(e.target.value) }
                                  : x,
                              ),
                            )
                          }
                          className="w-14 rounded-lg border border-slate-300 px-2 py-1.5"
                        />
                        tries
                      </label>
                      <button
                        onClick={() =>
                          setRecycleRules((rules) => rules.filter((_, j) => j !== i))
                        }
                        className="rounded-lg border border-red-200 px-2 py-1.5 font-medium text-red-600 hover:bg-red-50"
                        title="Remove rule"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Disposition rules ── */}
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  Disposition rules
                  {Object.keys(dispoRules).length > 0 && (
                    <span className="ml-1.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                      {Object.keys(dispoRules).length} changed
                    </span>
                  )}
                </p>
                <button
                  onClick={() => setDispoOpen((v) => !v)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50"
                >
                  {dispoOpen ? "Hide" : `Edit (${DISPOSITION_CATALOG.length})`}
                </button>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                What each <b>disposition reason</b> an agent saves does to the lead.
                This decides the next action, the retry timer and whether the lead
                is ever offered again — it outranks the recycle rules above, which
                only apply to calls no agent dispositioned.
              </p>

              {dispoOpen && (
                <div className="mt-2 space-y-1.5">
                  {DISPOSITION_CATALOG.map((d) => {
                    const rule = dispoRuleFor(d.code);
                    const changed = Boolean(dispoRules[d.code]);
                    const timed = rule.action === "retry" || rule.action === "callback";
                    return (
                      <div
                        key={d.code}
                        className={
                          "rounded-lg border px-2.5 py-2 text-xs " +
                          (changed ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200")
                        }
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="min-w-[5.5rem] font-semibold text-slate-800">
                            {d.code}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-slate-500">
                            {d.label}
                          </span>
                          <select
                            value={rule.action}
                            onChange={(e) =>
                              setDispoField(d.code, "action", e.target.value as DispositionAction)
                            }
                            className="rounded-lg border border-slate-300 px-1.5 py-1"
                          >
                            <option value="retry">Retry</option>
                            <option value="callback">Callback</option>
                            <option value="skip">Skip (park)</option>
                            <option value="close">Close</option>
                            <option value="dnc">DNC</option>
                          </select>
                          <label className="flex items-center gap-1 text-slate-600">
                            after
                            <input
                              type="number"
                              min={0}
                              max={525600}
                              disabled={!timed}
                              value={rule.delay_min ?? ""}
                              onChange={(e) =>
                                setDispoField(
                                  d.code,
                                  "delay_min",
                                  e.target.value === "" ? null : Number(e.target.value),
                                )
                              }
                              className="w-16 rounded-lg border border-slate-300 px-1.5 py-1 disabled:bg-slate-100 disabled:text-slate-400"
                            />
                            min
                          </label>
                          <label className="flex items-center gap-1 text-slate-600">
                            max
                            <input
                              type="number"
                              min={1}
                              max={50}
                              disabled={!timed}
                              value={rule.max_attempts ?? ""}
                              onChange={(e) =>
                                setDispoField(
                                  d.code,
                                  "max_attempts",
                                  e.target.value === "" ? null : Number(e.target.value),
                                )
                              }
                              className="w-14 rounded-lg border border-slate-300 px-1.5 py-1 disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          </label>
                          {changed && (
                            <button
                              onClick={() =>
                                setDispoRules((prev) => {
                                  const next = { ...prev };
                                  delete next[d.code];
                                  return next;
                                })
                              }
                              className="rounded-lg border border-slate-300 px-1.5 py-1 font-medium text-slate-600 hover:bg-white"
                              title="Back to the default rule"
                            >
                              ↺
                            </button>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">{describeRule(rule)}</p>
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-slate-400">
                    Reasons under a code can differ from it — &ldquo;Number busy&rdquo;
                    retries sooner than the rest of TNC, and a per-reason rule keeps
                    winning unless the code is changed here.
                  </p>
                </div>
              )}
            </div>

            {/* ── Lead handling — every mode has these ── */}
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-sm font-medium text-slate-700">Lead handling</p>
              <p className="mt-0.5 text-xs text-slate-500">
                How this campaign works its leads, whoever places the call.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <label className="flex flex-col gap-1">
                  <span className="font-medium text-slate-600">
                    Max attempts per lead (0 = ∞)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 px-2 py-1.5"
                  />
                  {maxAttempts > 0 && (
                    <span className="text-[11px] text-amber-600">
                      A lead is closed for good after {maxAttempts} call
                      {maxAttempts === 1 ? "" : "s"}, whatever the recycle rules
                      say.
                    </span>
                  )}
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-medium text-slate-600">Ring timeout (sec)</span>
                  <input
                    type="number"
                    min={10}
                    max={180}
                    value={dialTimeout}
                    onChange={(e) => setDialTimeout(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 px-2 py-1.5"
                  />
                </label>
                <label className="col-span-2 flex flex-col gap-1">
                  <span className="font-medium text-slate-600">Lead order</span>
                  <select
                    value={leadOrder}
                    onChange={(e) => setLeadOrder(e.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1.5"
                  >
                    {LEAD_ORDERS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="col-span-2 flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5">
                  <input
                    type="checkbox"
                    checked={callbacksOn}
                    onChange={(e) => setCallbacksOn(e.target.checked)}
                    className="accent-indigo-600"
                  />
                  <span className="font-medium text-slate-600">
                    Feed due callbacks back into the dial queue
                  </span>
                </label>
              </div>
            </div>

            {/* ── Pacing — only the modes the SERVER dials for have any ──
                 The controls follow src/lib/dialerModes.js, the same
                 definition the API validates against and the engine paces
                 by, so a setting can never be shown for a mode that would
                 refuse to store it. */}
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  {rulesMode === "predictive"
                    ? "Predictive pacing"
                    : rulesMode === "ratio"
                      ? "Ratio dialing"
                      : "Pacing"}
                </p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  {labelFor(rulesMode)} mode
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{describeMode(rulesMode)}</p>

              {rulesMode === "predictive" && (
                <>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-600">
                        Max lines per agent (ceiling)
                      </span>
                      <input
                        type="number"
                        step={0.1}
                        min={1}
                        max={10}
                        value={dialRatio}
                        onChange={(e) => setDialRatio(Number(e.target.value))}
                        className="rounded-lg border border-slate-300 px-2 py-1.5"
                      />
                      <span className="text-[11px] text-slate-400">
                        The engine computes the live figure; this is the most it
                        may ever reach.
                      </span>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-600">Max abandon %</span>
                      <input
                        type="number"
                        step={0.5}
                        min={0}
                        max={100}
                        value={maxAbandon}
                        onChange={(e) => setMaxAbandon(Number(e.target.value))}
                        className="rounded-lg border border-slate-300 px-2 py-1.5"
                      />
                      <span className="text-[11px] text-slate-400">
                        Pacing is damped from {(maxAbandon * 0.75).toFixed(1)}% and
                        drops to one line per agent above {maxAbandon}%.
                      </span>
                    </label>
                    <label className="col-span-2 flex flex-col gap-1">
                      <span className="font-medium text-slate-600">
                        Breather after a call (sec, 0 = none)
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={600}
                        value={wrapupSeconds}
                        onChange={(e) => setWrapupSeconds(Number(e.target.value))}
                        className="rounded-lg border border-slate-300 px-2 py-1.5"
                      />
                    </label>
                  </div>
                  {dialRatio > 1 && (
                    <p className="mt-1.5 text-xs text-amber-600">
                      ⚠ A ceiling above 1.0 lets the engine over-dial: some answered
                      calls may arrive with no free agent. It only goes there when
                      the measured answer rate says the agents will be free, and it
                      backs off before {maxAbandon}% abandons.
                    </p>
                  )}
                </>
              )}

              {rulesMode === "ratio" && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <label className="flex flex-col gap-1">
                    <span className="font-medium text-slate-600">
                      Lines per ready agent (fixed)
                    </span>
                    <input
                      type="number"
                      step={0.1}
                      min={1}
                      max={10}
                      value={dialRatio}
                      onChange={(e) => setDialRatio(Number(e.target.value))}
                      className="rounded-lg border border-slate-300 px-2 py-1.5"
                    />
                  </label>
                  <p className="self-end text-[11px] text-slate-400">
                    Exactly this many lines per ready agent, every tick. Switch the
                    campaign to Predictive if you want the figure computed.
                  </p>
                  {dialRatio > 1 && (
                    <p className="col-span-2 text-xs text-amber-600">
                      ⚠ Above 1.0 this over-dials with no forecast behind it. Only
                      the global abandon cutoff will hold it back.
                    </p>
                  )}
                </div>
              )}

              {rulesMode !== "predictive" && rulesMode !== "ratio" && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 ring-1 ring-inset ring-slate-200">
                  Nothing to pace — the server never places calls for a{" "}
                  {labelFor(rulesMode)} campaign, so there is no line count, no
                  abandon budget and no predictive engine running for it.
                </p>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={saveRules}
                disabled={rulesBusy}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {rulesBusy ? "Saving…" : "Save dial rules"}
              </button>
              <button
                onClick={() => setRulesFor(null)}
                disabled={rulesBusy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit gateways modal ── */}
      {editGwFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold">
              Edit gateways — {editGwFor.name}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Select the GSM gateways this campaign should use.
            </p>
            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {allGateways.map((gw) => {
                const checked = editGwIds.includes(gw.id);
                return (
                  <label
                    key={gw.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      checked
                        ? "border-indigo-400 bg-indigo-50"
                        : "border-slate-200 hover:bg-slate-50"
                    } ${gw.status === "inactive" ? "opacity-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={gw.status === "inactive"}
                      onChange={() =>
                        toggleGateway(gw.id, editGwIds, setEditGwIds)
                      }
                      className="accent-indigo-600"
                    />
                    <span className="flex-1 font-medium">{gw.name}</span>
                    <span className="text-xs text-slate-500">
                      {gw.ip} · {gw.channels}ch
                    </span>
                    {gwStatus[gw.id] ? (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                          gwStatus[gw.id].reachable
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {gwStatus[gw.id].reachable ? "● Online" : "● Offline"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-400">
                        ● Unknown
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            {editGwIds.length > 0 && (
              <p className="mt-2 text-xs text-indigo-600 font-medium">
                {editGwIds.length} gateway(s) ·{" "}
                {allGateways
                  .filter((g) => editGwIds.includes(g.id))
                  .reduce((s, g) => s + g.channels, 0)}{" "}
                total channels
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={updateCampaignGateways}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Save
              </button>
              <button
                onClick={() => setEditGwFor(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  Phone,
  PhoneOff,
  User,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Coffee,
  Play,
} from "lucide-react";
import { SipPhone, type CallState } from "@/lib/sipPhone";
import { getSocket, useSocketEvent } from "@/lib/useSocket";
import { Button } from "@/components/Button";
import {
  DISPOSITION_ACTION,
  DISPOSITION_CATALOG,
  describeRule,
  parseDispositionRules,
  resolveDisposition,
} from "@/lib/dispositionRules";
import { isEngineDriven, isPredictive } from "@/lib/dialerModes";
import type { Campaign, Contact, SipConfig, CallDisposition, DialerType } from "@/types";

/**
 * Normalize a contact's custom_fields into ordered [label, value] entries.
 */
function asEntries(v: unknown): [string, unknown][] {
  let parsed: unknown = v;
  if (!parsed) return [];
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }
  if (Array.isArray(parsed)) {
    return parsed
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map((p) => [String((p as unknown[])[0]), (p as unknown[])[1]] as [string, unknown]);
  }
  if (parsed && typeof parsed === "object") {
    return Object.entries(parsed as Record<string, unknown>);
  }
  return [];
}

const DIALER_LABELS: Record<string, string> = {
  predictive: "Predictive Dialer",
  manual: "Manual Dialer",
  inbound: "Inbound Dialer",
  ratio: "Ratio Dialer",
};

const DISPOSITIONS: { value: CallDisposition; label: string }[] = [
  { value: "connected", label: "Connected" },
  { value: "no_answer", label: "No Answer" },
  { value: "busy", label: "Busy" },
  { value: "voicemail", label: "Voicemail" },
  { value: "wrong_number", label: "Wrong Number" },
  { value: "failed", label: "Failed" },
];

const PAY_MODES = ["Cash", "Bank Transfer", "Online", "UPI", "Cheque"];

const STATE_LABEL: Record<CallState, string> = {
  idle: "Idle",
  connecting: "Calling…",
  ringing: "Ringing…",
  "in-call": "Connected",
  ended: "Call ended",
};

function fmt(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function causeToDisposition(answered: boolean, cause: string): CallDisposition {
  if (answered) return "connected";
  const c = (cause || "").toLowerCase();
  if (c.includes("busy")) return "busy";
  if (c.includes("answer") || c.includes("cancel") || c.includes("unavailable") || c.includes("rejected"))
    return "no_answer";
  return "failed";
}

function initialsOf(name: string | null | undefined, fallback: string) {
  if (!name) return fallback.slice(-2);
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface CallMeta {
  placedAt: number;
  answeredAt: number | null;
  phoneNumber: string;
  contactName: string | null;
  campaignId: number | null;
  csvDataId: number | null;
  /** calls.id opened by the server for this attempt (null for a typed number). */
  callId: number | null;
  /** The mode this call was placed in — it decides which wrap-up fields the
   *  agent sees, so it is captured with the call and not read live. */
  dialerType: DialerType;
}

interface PostCall {
  phoneNumber: string;
  contactName: string | null;
  campaignId: number | null;
  csvDataId: number | null;
  callId: number | null;
  durationSeconds: number;
  defaultDisposition: CallDisposition;
  dialerType: DialerType;
}

export function Dialer() {
  const [sip, setSip] = useState<SipConfig | null>(null);
  const [registered, setRegistered] = useState(false);
  const [callState, setCallState] = useState<CallState>("idle");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoaded, setCampaignsLoaded] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const [gatewayReachable, setGatewayReachable] = useState<boolean | null>(null);
  const [gatewayWarning, setGatewayWarning] = useState<string | null>(null);
  const [manualNumber, setManualNumber] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [sessionCalls, setSessionCalls] = useState(0);
  const [postCall, setPostCall] = useState<PostCall | null>(null);
  // Manual mode: one reserved lead at a time, plus the ids this agent skipped
  // so "Next" always moves forward instead of re-offering the same row.
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadReason, setLeadReason] = useState<string | null>(null);
  const skippedRef = useRef<number[]>([]);

  // post-call wrap-up form
  const [pcDisposition, setPcDisposition] = useState<CallDisposition>("connected");
  const [pcNote, setPcNote] = useState("");
  const [pcDispo, setPcDispo] = useState("");
  const [pcReason, setPcReason] = useState("");
  const [pcAmt, setPcAmt] = useState("");
  const [pcPayDate, setPcPayDate] = useState("");
  const [pcMode, setPcMode] = useState("");
  const [pcSchedule, setPcSchedule] = useState(false);
  const [pcFollowUpAt, setPcFollowUpAt] = useState("");
  const [saving, setSaving] = useState(false);

  const phoneRef = useRef<SipPhone | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const metaRef = useRef<CallMeta | null>(null);
  const sipRef = useRef<SipConfig | null>(null);
  sipRef.current = sip;
  const registeredRef = useRef(false);
  registeredRef.current = registered;
  const campaignRef = useRef<Campaign | null>(null);
  campaignRef.current = campaign;
  const contactRef = useRef<Contact | null>(null);
  contactRef.current = contact;
  const autoRunningRef = useRef(false);
  autoRunningRef.current = autoRunning;

  /* ---- the wrap-up's disposition rule ----
   * Resolved from the same catalogue and the same campaign overrides the
   * server uses, so what the agent is told here is what actually happens. */
  const dispoOverrides = useMemo(
    () => parseDispositionRules(campaign?.disposition_rules),
    [campaign],
  );
  const reasonOptions =
    DISPOSITION_CATALOG.find((entry) => entry.code === pcDispo)?.reasons ?? [];
  const dispoRule = pcDispo
    ? resolveDisposition({ code: pcDispo, reason: pcReason, overrides: dispoOverrides })
    : null;
  const reasonNeedsPayment = Boolean(dispoRule?.requiresPayment);
  const ruleClosesLead =
    dispoRule?.action === DISPOSITION_ACTION.CLOSE ||
    dispoRule?.action === DISPOSITION_ACTION.DNC;
  const ruleNeedsFollowUp = Boolean(dispoRule?.requires_followup);
  // Predictive and ratio pop only connected calls onto the screen, so there is
  // no line result left for the agent to judge — the disposition is the whole
  // wrap-up. Manual (and inbound) still ask for what the line did.
  const showCallStatus = postCall !== null && !isEngineDriven(postCall.dialerType);
  // Declared here (not lower down) because the manual-lead effects below list it
  // as a dependency — a `const` referenced before its initialiser would throw.
  const inCall =
    callState === "connecting" || callState === "ringing" || callState === "in-call";

  const handleCallState = useCallback((s: CallState) => {
    setCallState(s);
    if (s === "in-call" && metaRef.current && metaRef.current.answeredAt === null) {
      metaRef.current.answeredAt = Date.now();
    }
  }, []);

  const handleCallEnded = useCallback(
    (info: { answered: boolean; cause: string }) => {
      const m = metaRef.current;
      if (!m) return;
      const durationSeconds = m.answeredAt
        ? Math.round((Date.now() - m.answeredAt) / 1000)
        : 0;
      setPostCall({
        phoneNumber: m.phoneNumber,
        contactName: m.contactName,
        campaignId: m.campaignId,
        csvDataId: m.csvDataId,
        callId: m.callId,
        durationSeconds,
        defaultDisposition: causeToDisposition(info.answered, info.cause),
        dialerType: m.dialerType,
      });
      metaRef.current = null;
    },
    [],
  );

  useEffect(() => {
    let phone: SipPhone | null = null;
    (async () => {
      try {
        const res = await fetch("/api/employee/sip");
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Could not load SIP configuration");
          return;
        }
        setSip(data);
        if (audioRef.current) {
          phone = new SipPhone(audioRef.current, {
            onRegistered: setRegistered,
            onCallState: handleCallState,
            onCallEnded: handleCallEnded,
          });
          phone.start({
            wssUrl: data.wssUrl,
            sipUri: `sip:${data.extension}@${data.sipServer}`,
            authUser: data.extension,
            password: data.password,
            displayName: data.displayName,
          });
          phoneRef.current = phone;
        }
      } catch {
        toast.error("Failed to initialise the dialer");
      }
    })();

    (async () => {
      try {
        const res = await fetch("/api/employee/campaigns");
        const data = await res.json();
        if (res.ok && data.campaigns?.length) {
          setCampaigns(data.campaigns);
          setCampaign(data.campaigns[0]);
        }
      } catch { /* ignore */ }
      finally { setCampaignsLoaded(true); }
    })();

    return () => { phone?.stop(); };
  }, [handleCallState, handleCallEnded]);

  useEffect(() => {
    const onCall = callState === "connecting" || callState === "ringing" || callState === "in-call";
    getSocket().emit("set-state", onCall ? "on-call" : "idle");
  }, [callState]);

  useEffect(() => {
    if (callState !== "connecting" && callState !== "ringing" && callState !== "in-call") return;
    const t = setInterval(() => {
      if (metaRef.current) {
        setElapsed(Math.round((Date.now() - metaRef.current.placedAt) / 1000));
      }
    }, 500);
    return () => clearInterval(t);
  }, [callState]);

  useEffect(() => {
    if (postCall) {
      setPcDisposition(postCall.defaultDisposition);
      setPcNote("");
      setPcDispo("");
      setPcReason("");
      setPcAmt("");
      setPcPayDate("");
      setPcMode("");
      setPcSchedule(false);
      setPcFollowUpAt("");
    }
  }, [postCall]);

  // The chosen reason decides whether a callback is part of the disposition:
  // one that books an appointment always schedules, one that closes the lead
  // never does. Keeping the form in step is what makes the preview honest.
  useEffect(() => {
    if (ruleNeedsFollowUp) setPcSchedule(true);
    else if (ruleClosesLead) { setPcSchedule(false); setPcFollowUpAt(""); }
  }, [ruleNeedsFollowUp, ruleClosesLead]);

  function startCall(phoneNumber: string, contactName: string | null, cId: number | null, csvId: number | null): boolean {
    const s = sipRef.current;
    if (!phoneRef.current || !s) return false;
    if (!registeredRef.current) { toast.warning("Phone is not registered yet"); return false; }
    if (gatewayReachable === false) {
      toast.error(gatewayWarning ?? "Gateway is offline — cannot place call");
      return false;
    }
    const target = phoneNumber.trim();
    if (!target) return false;
    metaRef.current = {
      placedAt: Date.now(), answeredAt: null,
      phoneNumber: target, contactName,
      campaignId: cId, csvDataId: csvId,
      // A manual dial's history row is opened by the server when the call
      // reaches Asterisk; the wrap-up finds it by lead id.
      callId: null,
      // The agent placed this one and watched it ring, so the wrap-up asks
      // what the line did — even on a predictive campaign, where a call the
      // server delivered would not.
      dialerType: "manual",
    };
    setElapsed(0);
    const gw = campaignRef.current?.gateways?.find((g) => g.asterisk_endpoint);
    phoneRef.current.call(target, s.sipServer, gw?.asterisk_endpoint ?? undefined);
    return true;
  }

  /* ---------------- manual mode: one reserved lead at a time ---------------- */

  /** Hand the current reservation back. Never a call outcome — the server rolls
   *  the lead to the status it held before, leaving counters and history alone. */
  const releaseLead = useCallback(
    async (leadId: number, reason: "skip" | "campaign-switch" | "closed") => {
      try {
        await fetch("/api/employee/dialer/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, reason }),
        });
      } catch {
        /* the claim times out server-side anyway */
      }
    },
    [],
  );

  /** Reserve exactly ONE eligible lead. Loading is not calling. */
  const loadNextLead = useCallback(async (campaignId: number) => {
    setLeadBusy(true);
    setLeadReason(null);
    try {
      const qs = new URLSearchParams({ campaignId: String(campaignId) });
      if (skippedRef.current.length > 0) qs.set("exclude", skippedRef.current.join(","));
      const res = await fetch(`/api/employee/dialer/next?${qs}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setLeadReason("Could not load a contact");
        return;
      }
      // A campaign switch during the round trip must not adopt a stale lead.
      if (campaignRef.current?.id !== campaignId) {
        if (data.contact) await releaseLead(data.contact.id, "campaign-switch");
        return;
      }
      if (data.contact) {
        setContact(data.contact);
      } else {
        setContact(null);
        setLeadReason(
          data.reason === "no-active-lists"
            ? "No list is switched ON for this campaign."
            : data.reason === "all-numbers-busy"
              ? "Every remaining number is already on a call."
              : "No eligible contacts left in this campaign.",
        );
      }
    } catch {
      setLeadReason("Network error while loading a contact");
    } finally {
      setLeadBusy(false);
    }
  }, [releaseLead]);

  /** Skip: release, remember it, take the next one. No call data is written. */
  async function skipLead() {
    const c = contactRef.current;
    const camp = campaignRef.current;
    if (!c || !camp || leadBusy) return;
    skippedRef.current = [...skippedRef.current, c.id].slice(-50);
    setContact(null);
    await releaseLead(c.id, "skip");
    await loadNextLead(camp.id);
  }

  /** Call the loaded contact — server re-validates the claim first. */
  async function callLoadedContact() {
    const c = contactRef.current;
    if (!c || inCall || leadBusy) return;
    setLeadBusy(true);
    try {
      const res = await fetch("/api/employee/dialer/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: c.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.allowed) {
        const why: Record<string, string> = {
          "claimed-by-another-agent": "Another agent already took this contact",
          "lead-no-longer-queued": "This contact is no longer available",
          "phone-already-on-a-call": "That number is already on a call",
          "campaign-not-assigned": "You are not assigned to this campaign",
          "lead-not-found": "This contact no longer exists",
        };
        toast.warning(why[data?.reason] ?? "Could not start this call");
        setContact(null);
        if (campaignRef.current) await loadNextLead(campaignRef.current.id);
        return;
      }
      startCall(c.phone_number, c.name ?? null, campaignRef.current?.id ?? null, c.id);
    } catch {
      toast.error("Network error");
    } finally {
      setLeadBusy(false);
    }
  }

  // Load one lead when a manual campaign is selected, and after each wrap-up.
  useEffect(() => {
    if (!registered || !campaign || campaign.dialer_type !== "manual") return;
    if (contact || postCall || inCall) return;
    loadNextLead(campaign.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registered, campaign, contact, postCall, inCall]);

  // The server refused to pace for this campaign, or an admin switched its
  // mode while we were signed on. Either way the auto-dialer will not open
  // lines for us any more, so leave auto mode instead of waiting for a call
  // that is never coming.
  useSocketEvent(
    "dialer-mode-changed",
    (p: { campaignId?: number; dialerType?: string; reason?: string }) => {
      if (p?.campaignId && campaignRef.current?.id !== p.campaignId) return;
      setAutoRunning(false);
      if (p?.dialerType) {
        setCampaign((c) =>
          c && c.id === p.campaignId ? { ...c, dialer_type: p.dialerType as DialerType } : c,
        );
      }
      if (p?.reason) toast.info(p.reason);
    },
  );

  // Another agent claimed/released/finished something — if we are waiting for a
  // contact, try again. The database stays the source of truth.
  useSocketEvent("data-changed", (p: { scope?: string }) => {
    if (p?.scope !== "dialer") return;
    const camp = campaignRef.current;
    if (!camp || camp.dialer_type !== "manual") return;
    if (contactRef.current || postCall || inCall) return;
    loadNextLead(camp.id);
  });

  useEffect(() => {
    if (!campaign) return;
    fetch(`/api/employee/gateway-status?campaignId=${campaign.id}`)
      .then((r) => r.json())
      .then((data) => {
        setGatewayReachable(data.reachable);
        setGatewayWarning(data.reachable ? null : (data.reason ?? "Gateway offline"));
      })
      .catch(() => { setGatewayReachable(null); setGatewayWarning(null); });
  }, [campaign]);

  useEffect(() => {
    // Only the modes the SERVER dials for put an agent in the pacing pool —
    // the same rule the engine and the socket handler enforce.
    const isAuto = isEngineDriven(campaign?.dialer_type);
    if (!registered || !campaign || !isAuto) return;

    const socket = getSocket();
    socket.emit("agent-available", {
      extension: sipRef.current?.extension,
      campaignId: campaign.id,
    });
    setAutoRunning(true);

    const onAssigned = (c: Contact) => {
      setContact(c);
      metaRef.current = {
        placedAt: Date.now(), answeredAt: Date.now(),
        phoneNumber: c.phone_number, contactName: c.name ?? null,
        campaignId: campaign.id, csvDataId: c.id,
        callId: c.call_id ?? null,
        dialerType: campaign.dialer_type,
      };
      setElapsed(0);
      setCallState("in-call");
    };
    socket.on("assigned-call", onAssigned);
    return () => { socket.off("assigned-call", onAssigned); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registered, campaign]);

  function startAuto() {
    if (!campaign) return;
    setComplete(false);
    setAutoRunning(true);
    getSocket().emit("agent-available", {
      extension: sipRef.current?.extension,
      campaignId: campaign.id,
    });
  }

  function stopAuto() {
    setAutoRunning(false);
    getSocket().emit("agent-break");
  }

  function onHangup() { phoneRef.current?.hangup(); }

  function manualCall() {
    if (manualNumber.trim()) {
      startCall(manualNumber.trim(), null, campaignRef.current?.id ?? null, null);
    }
  }

  async function savePostCall() {
    if (!postCall) return;
    // The disposition reason is what drives the dialing rules, so it is
    // required in every mode — in predictive and ratio it is also the only
    // thing the call status can be derived from.
    if (!pcDispo) { toast.warning("Select a disposition"); return; }
    if (reasonOptions.length > 0 && !pcReason) {
      toast.warning("Select a disposition reason");
      return;
    }
    if (reasonNeedsPayment) {
      if (!pcAmt) { toast.warning("Amount zaroori hai"); return; }
      if (!pcPayDate) { toast.warning("Payment date zaroori hai"); return; }
      if (!pcMode) { toast.warning("Payment mode zaroori hai"); return; }
    }
    if (ruleNeedsFollowUp && !(pcSchedule && pcFollowUpAt)) {
      toast.warning("This disposition needs a follow-up date and time");
      return;
    }

    setSaving(true);
    try {
      const parts: string[] = [];
      if (pcNote.trim()) parts.push(pcNote.trim());
      if (pcDispo && pcReason) {
        let dispoLine = `[${pcDispo} - ${pcReason}`;
        if (reasonNeedsPayment) {
          dispoLine += ` | amt:${pcAmt || "?"} date:${pcPayDate || "?"} mode:${pcMode || "?"}`;
        }
        dispoLine += `]`;
        parts.push(dispoLine);
      } else if (pcDispo) {
        parts.push(`[${pcDispo}]`);
      }
      const composedNote = parts.length ? parts.join("\n") : null;

      const res = await fetch("/api/employee/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: postCall.phoneNumber,
          contactName: postCall.contactName,
          campaignId: postCall.campaignId,
          csvDataId: postCall.csvDataId,
          callId: postCall.callId,
          // Omitted in predictive/ratio: the server derives it from the
          // disposition rather than trusting a field the agent never saw.
          status: showCallStatus ? pcDisposition : null,
          durationSeconds: postCall.durationSeconds,
          note: composedNote,
          tags: pcDispo || null,
          dispositionReason: pcReason || null,
          followUpAt:
            !ruleClosesLead && pcSchedule && pcFollowUpAt ? pcFollowUpAt : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Could not save call"); return; }
      setSessionCalls((n) => n + 1);
      setPostCall(null);
      setCallState("idle");
      setElapsed(0);
      setContact(null);
      // A real attempt is finished — it must not be skipped past next time.
      skippedRef.current = skippedRef.current.filter((id) => id !== postCall.csvDataId);
      if (autoRunningRef.current) {
        getSocket().emit("agent-available", {
          extension: sipRef.current?.extension,
          campaignId: campaignRef.current?.id,
        });
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  const noCampaign = campaignsLoaded && !campaign;

  function switchCampaign(id: number) {
    const next = campaigns.find((c) => c.id === id);
    if (!next || next.id === campaign?.id) return;
    getSocket().emit("agent-break");
    setAutoRunning(false);
    // Give the old campaign's reservation back before moving, so the lead is
    // immediately available to everyone else instead of waiting out its claim.
    const held = contactRef.current;
    if (held) releaseLead(held.id, "campaign-switch");
    setContact(null);
    skippedRef.current = [];
    setLeadReason(null);
    setCampaign(next);
    setComplete(false);
  }

  const isAutoCampaign = isEngineDriven(campaign?.dialer_type);
  const customEntries = contact ? asEntries(contact.custom_fields).filter(([, v]) => v !== null && v !== "" && v !== undefined) : [];

  return (
    <div className="w-full">
      <audio ref={audioRef} autoPlay muted={false} className="hidden" />

      {/* Gateway warning */}
      {gatewayWarning && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <b>{gatewayWarning}</b> — calls are blocked until the gateway comes online.
          </span>
        </div>
      )}

      {/* ===== TOP BAR — everything the agent glances at, on one line =====
           Identity, the campaign they are working, the live call and the
           phone's registration all sit together so the screen below can be
           given entirely to the customer. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/60">
        {/* Who and where */}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Phone className="h-4 w-4" strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight tracking-tight text-slate-900">
            {campaign ? (DIALER_LABELS[campaign.dialer_type] ?? "Dialer") : "Dialer"}
          </p>
          <p className="text-[11px] leading-tight text-slate-500">
            {sip?.extension ? `Ext ${sip.extension}` : "Loading…"}
          </p>
        </div>

        {/* Campaign — compact, right beside the title */}
        {!noCampaign && (
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:inline">
              Campaign
            </span>
            {campaigns.length > 1 ? (
              <select
                value={campaign?.id ?? ""}
                disabled={callState !== "idle" || autoRunning}
                onChange={(e) => switchCampaign(Number(e.target.value))}
                className="max-w-[13rem] truncate rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60"
                title={autoRunning ? "Stop the dialer before switching campaigns" : undefined}
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <span className="max-w-[13rem] truncate rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800 ring-1 ring-inset ring-slate-200">
                {campaign?.name ?? "…"}
              </span>
            )}
            {isAutoCampaign ? (
              <span
                className={
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset " +
                  (complete
                    ? "bg-blue-50 text-blue-700 ring-blue-600/20"
                    : autoRunning
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                      : "bg-slate-50 text-slate-600 ring-slate-500/20")
                }
              >
                <span className={"h-1.5 w-1.5 rounded-full " + (complete ? "bg-blue-500" : autoRunning ? "bg-emerald-500" : "bg-slate-400")} />
                {complete ? "Complete" : autoRunning ? "Available" : "On break"}
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-inset ring-slate-500/20">
                {campaign?.dialer_type ?? "manual"}
              </span>
            )}
          </div>
        )}

        {/* Live call — the old full-height card, now a single strip */}
        <div className="ml-auto flex items-center gap-2.5 rounded-xl bg-slate-900 px-3 py-1.5 text-white">
          <span
            className={
              "h-1.5 w-1.5 shrink-0 rounded-full " +
              (callState === "in-call"
                ? "animate-pulse bg-rose-400"
                : inCall
                  ? "animate-pulse bg-amber-400"
                  : "bg-slate-500")
            }
          />
          <span className="text-xs font-semibold">{STATE_LABEL[callState]}</span>
          <span className="max-w-[9rem] truncate font-mono text-[11px] text-slate-400">
            {metaRef.current?.phoneNumber || manualNumber || "—"}
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums">{fmt(elapsed)}</span>
          <button
            onClick={onHangup}
            disabled={!inCall}
            className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <PhoneOff className="h-3 w-3" />
            Hang up
          </button>
        </div>

        {/* Registration */}
        <span
          className={
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset " +
            (registered
              ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
              : "bg-rose-50 text-rose-700 ring-rose-600/20")
          }
        >
          <span className={"h-1.5 w-1.5 rounded-full " + (registered ? "bg-emerald-500" : "bg-rose-500 animate-pulse")} />
          {registered ? "Phone registered" : "Connecting…"}
        </span>

        {/* Session counter, mode hint and the availability control */}
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2">
          <span className="text-xs text-slate-500">
            Calls this session
            <span className="ml-1.5 font-semibold tabular-nums text-slate-900">
              {sessionCalls}
            </span>
          </span>
          {noCampaign ? (
            <span className="flex items-center gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              No campaign available — ask your admin or team lead to add you to a
              group with an active campaign.
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
              {isAutoCampaign
                ? isPredictive(campaign?.dialer_type)
                  ? "Server places the calls and paces itself from the answer rate — a connected customer is dropped onto your screen. Take a break before stepping away."
                  : "Server places the calls at this campaign's fixed line ratio — a connected customer is dropped onto your screen. Take a break before stepping away."
                : campaign?.dialer_type === "inbound"
                  ? "Inbound mode — waiting for incoming calls."
                  : "Manual mode — one contact is reserved for you at a time. Press Call when you are ready, or Next to skip it."}
            </span>
          )}
          {isAutoCampaign &&
            (autoRunning ? (
              <button
                onClick={stopAuto}
                className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
              >
                <Coffee className="h-3.5 w-3.5" />
                Take break
              </button>
            ) : (
              <button
                onClick={startAuto}
                disabled={!registered || !campaign}
                className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5" />
                {complete ? "Restart" : "Go available"}
              </button>
            ))}
        </div>
      </div>

      {/* ===== CUSTOMER — the whole screen ===== */}
      <div className="mb-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
        {contact ? (
          <div className="space-y-4">
            {/* Identity + the actions that apply to this contact */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-sm">
                {initialsOf(contact.name, contact.phone_number)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight text-slate-900">
                  {contact.name ?? "Unknown contact"}
                </p>
                <p className="font-mono text-sm text-slate-500">{contact.phone_number}</p>
              </div>
              <span className="inline-flex shrink-0 items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                Customer
              </span>

              {/* Manual mode: call this reserved contact, or move to the next */}
              {campaign?.dialer_type === "manual" && !inCall && !postCall && (
                <div className="ml-auto flex flex-wrap gap-2">
                  <button
                    onClick={callLoadedContact}
                    disabled={!registered || leadBusy || gatewayReachable === false}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Phone className="h-4 w-4" />
                    Call
                  </button>
                  <button
                    onClick={skipLead}
                    disabled={leadBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {leadBusy ? "Working…" : "Next lead / Skip"}
                  </button>
                </div>
              )}
            </div>

            {/* Every field on the record, laid out across the full width */}
            {customEntries.length > 0 && (
              <div className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {customEntries.map(([key, val]) => (
                  <div
                    key={key}
                    className="min-w-0 rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-inset ring-slate-200"
                  >
                    <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      {key}
                    </p>
                    <p className="truncate text-sm font-medium text-slate-800" title={String(val)}>
                      {String(val)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 py-6 text-sm text-slate-400">
            <User className="h-4 w-4" />
            <span>
              {autoRunning
                ? "Waiting for the next connected call…"
                : leadBusy
                  ? "Loading the next contact…"
                  : (leadReason ?? "No contact loaded.")}
            </span>
          </div>
        )}
      </div>

      {/* ===== Manual call · Call script ===== */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Manual call
          </h2>
          <div className="flex gap-2">
            <input
              value={manualNumber}
              onChange={(e) => setManualNumber(e.target.value)}
              disabled={autoRunning || inCall}
              placeholder="Phone number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50"
            />
            <button
              onClick={manualCall}
              disabled={autoRunning || inCall || !manualNumber.trim() || !registered}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Phone className="h-3.5 w-3.5" />
              Call
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Available when the auto-dialer is stopped.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
          <div className="mb-2 flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-slate-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Call script
            </h2>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {campaign?.script ?? (
              <span className="text-slate-400">No script for this campaign.</span>
            )}
          </p>
        </div>
      </div>

      {/* ===== Wrap-up modal ===== */}
      {postCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5">
            {/* Header */}
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h2 className="text-base font-semibold tracking-tight text-slate-900">
                  Wrap up call
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {postCall.contactName ? postCall.contactName + " · " : ""}
                <span className="font-mono">{postCall.phoneNumber}</span>
                <span className="mx-1">·</span>
                <span className="tabular-nums">{fmt(postCall.durationSeconds)}</span>
              </p>
            </div>

            {/* Body */}
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-3">
              {showCallStatus ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Call status
                  </label>
                  <select
                    value={pcDisposition}
                    onChange={(e) => setPcDisposition(e.target.value as CallDisposition)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    {DISPOSITIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 ring-1 ring-inset ring-slate-200">
                  {DIALER_LABELS[postCall.dialerType] ?? "The dialer"} handled the line —
                  the call was already connected, so only the disposition is needed.
                </p>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  DISPO
                </label>
                <select
                  value={pcDispo}
                  onChange={(e) => {
                    setPcDispo(e.target.value);
                    setPcReason(""); setPcAmt(""); setPcPayDate(""); setPcMode("");
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">— select disposition —</option>
                  {DISPOSITION_CATALOG.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.code} — {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {pcDispo && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Disposition reason
                  </label>
                  <select
                    value={pcReason}
                    onChange={(e) => setPcReason(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">— select reason —</option>
                    {reasonOptions.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  {pcReason && dispoRule && (
                    <p
                      className={
                        "mt-1.5 rounded-lg px-2.5 py-1.5 text-[11px] ring-1 ring-inset " +
                        (ruleClosesLead
                          ? "bg-rose-50 text-rose-700 ring-rose-600/20"
                          : dispoRule.action === DISPOSITION_ACTION.CALLBACK
                            ? "bg-indigo-50 text-indigo-700 ring-indigo-600/20"
                            : "bg-slate-50 text-slate-600 ring-slate-500/20")
                      }
                    >
                      {describeRule(dispoRule)}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Call notes
                </label>
                <textarea
                  value={pcNote}
                  onChange={(e) => setPcNote(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="What did you discuss?"
                />
              </div>

              {reasonNeedsPayment && (
                <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-inset ring-amber-200">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                    Payment details
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600">Amount</label>
                      <input
                        value={pcAmt}
                        onChange={(e) => setPcAmt(e.target.value)}
                        inputMode="numeric"
                        placeholder="₹"
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600">Date</label>
                      <input
                        type="date"
                        value={pcPayDate}
                        onChange={(e) => {
                          setPcPayDate(e.target.value);
                          if (e.target.value) {
                            setPcSchedule(true);
                            setPcFollowUpAt(e.target.value + "T10:00");
                          }
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600">Mode</label>
                      <select
                        value={pcMode}
                        onChange={(e) => setPcMode(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      >
                        <option value="">—</option>
                        {PAY_MODES.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* A closing disposition takes the lead out of the queue, so a
                  callback would only put it straight back — the box is gone. */}
              {!ruleClosesLead && (
                <div className="rounded-xl border border-slate-200 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={pcSchedule}
                      disabled={ruleNeedsFollowUp}
                      onChange={(e) => setPcSchedule(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                    />
                    Schedule a follow-up call
                    {ruleNeedsFollowUp && (
                      <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                        Required
                      </span>
                    )}
                  </label>
                  {pcSchedule && (
                    <input
                      type="datetime-local"
                      value={pcFollowUpAt}
                      onChange={(e) => setPcFollowUpAt(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3">
              <Button onClick={savePostCall} loading={saving} className="w-full">
                {saving ? "Saving…" : autoRunning ? "Save & next call" : "Save call"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
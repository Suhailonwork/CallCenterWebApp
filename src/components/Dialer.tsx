// "use client";

// import { useCallback, useEffect, useRef, useState } from "react";
// import { toast } from "react-toastify";
// import { SipPhone, type CallState } from "@/lib/sipPhone";
// import { getSocket } from "@/lib/useSocket";
// import { Button } from "@/components/Button";
// import type { Campaign, Contact, SipConfig, CallDisposition } from "@/types";



// /**
//  * Normalize a contact's custom_fields into ordered [label, value] entries.
//  * Campaigns with a Data Table store an ORDERED array of [col, value] pairs
//  * (so the agent sees columns in the table's exact order — MySQL JSON objects
//  * re-sort their keys, arrays don't). Legacy/no-table contacts store a plain
//  * object, which we still render via Object.entries. Both shapes are accepted,
//  * whether already parsed (from JSON columns / socket) or a JSON string.
//  */
// function asEntries(v: unknown): [string, unknown][] {
//   let parsed: unknown = v;
//   if (!parsed) return [];
//   if (typeof parsed === "string") {
//     try { parsed = JSON.parse(parsed); } catch { return []; }
//   }
//   if (Array.isArray(parsed)) {
//     return parsed
//       .filter((p) => Array.isArray(p) && p.length >= 2)
//       .map((p) => [String((p as unknown[])[0]), (p as unknown[])[1]] as [string, unknown]);
//   }
//   if (parsed && typeof parsed === "object") {
//     return Object.entries(parsed as Record<string, unknown>);
//   }
//   return [];
// }


// const DIAL_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

// const DIALER_LABELS: Record<string, string> = {
//   predictive: "Predictive Dialer",
//   manual: "Manual Dialer",
//   inbound: "Inbound Dialer",
//   ratio: "Ratio Dialer",
// };

// const DISPOSITIONS: { value: CallDisposition; label: string }[] = [
//   { value: "connected", label: "Connected" },
//   { value: "no_answer", label: "No Answer" },
//   { value: "busy", label: "Busy" },
//   { value: "voicemail", label: "Voicemail" },
//   { value: "wrong_number", label: "Wrong Number" },
//   { value: "failed", label: "Failed" },
// ];

// // ---- DISPO categories aur unke reason sub-options ----
// // "$" se shuru reason = payment fields (amount/date/mode) zaroori
// const DISPO_OPTIONS: Record<string, string[]> = {
//   PAID: ["Full Paid", "Settlement Paid", "Partial Paid"],
//   PC: [
//     "On the way (Branch)",
//     "On the way (Bank)",
//     "Customer doing online Payment",
//   ],
//   PTP: ["$Customer ready to pay"],
//   CBPTP: ["$Future PTP"],
//   SETT: ["$Customer ready to pay settlement"],
//   BPTP: [
//     "Excuse - asking days for payment",
//     "Emergency Reason / Death / Accident",
//   ],
//   CB: [
//     "Customer in Emergency",
//     "Call back later",
//     "Out of station",
//     "Other",
//     "Statement verification",
//   ],
//   FI: [
//     "PFI-Permanent - Unemployed / Out of job",
//     "SFI-Short Term - Business Issue",
//     "Vehicle Viability / EMI Affordability",
//   ],
//   NFI: [
//     "CUACC-Customer Met with Accident",
//     "VEHAC-Vehicle Met with Accident",
//     "MEDIS-Medical Issue",
//     "FMEXP-Death of Family Member",
//   ],
//   SI: [
//     "NORC-RC Copy not Received",
//     "TISSU-Technical Issue in Vehicle",
//     "EMIDP-EMI or DP Issue",
//   ],
//   TNC: [
//     "Ringing",
//     "Not Reachable",
//     "Switch off",
//     "Number busy",
//     "Beep Silence",
//     "No voice / Voice issue",
//   ],
//   SKIP: [
//     "MIGR-Customer Migrated / Shift",
//     "CUNA-Not Available at visit place",
//     "FRAUD-Fraud Case",
//   ],
//   LM: ["Left Message"],
//   LPR: ["Language Problem"],
//   LN: ["Legal Notice"],
//   PTV: ["Pick the Vehicle"],
//   WN: ["Wrong Number"],
//   ID: ["Intentional Defaulter"],
//   VPC: ["Vehicle under police custody"],
//   VDLR: ["Vehicle with dealer"],
//   CD: ["Call drop"],
//   Repo: ["Vehicle Repo"],
//   Account: ["Account Close"],
// };

// const PAY_MODES = ["Cash", "Bank Transfer", "Online", "UPI", "Cheque"];

// const STATE_LABEL: Record<CallState, string> = {
//   idle: "Idle",
//   connecting: "Calling…",
//   ringing: "Ringing…",
//   "in-call": "Connected",
//   ended: "Call ended",
// };

// function fmt(sec: number) {
//   const m = Math.floor(sec / 60)
//     .toString()
//     .padStart(2, "0");
//   const s = Math.floor(sec % 60)
//     .toString()
//     .padStart(2, "0");
//   return `${m}:${s}`;
// }

// function causeToDisposition(answered: boolean, cause: string): CallDisposition {
//   if (answered) return "connected";
//   const c = (cause || "").toLowerCase();
//   if (c.includes("busy")) return "busy";
//   if (
//     c.includes("answer") ||
//     c.includes("cancel") ||
//     c.includes("unavailable") ||
//     c.includes("rejected")
//   )
//     return "no_answer";
//   return "failed";
// }

// interface CallMeta {
//   placedAt: number;
//   answeredAt: number | null;
//   phoneNumber: string;
//   contactName: string | null;
//   campaignId: number | null;
//   csvDataId: number | null;
// }

// interface PostCall {
//   phoneNumber: string;
//   contactName: string | null;
//   campaignId: number | null;
//   csvDataId: number | null;
//   durationSeconds: number;
//   defaultDisposition: CallDisposition;
// }

// export function Dialer() {
//   const [sip, setSip] = useState<SipConfig | null>(null);
//   const [registered, setRegistered] = useState(false);
//   const [callState, setCallState] = useState<CallState>("idle");
//   const [campaign, setCampaign] = useState<Campaign | null>(null);
//   const [campaigns, setCampaigns] = useState<Campaign[]>([]);
//   const [campaignsLoaded, setCampaignsLoaded] = useState(false);
//   const [contact, setContact] = useState<Contact | null>(null);
//   const [autoRunning, setAutoRunning] = useState(false);
//   const [complete, setComplete] = useState(false);
//   const [gatewayReachable, setGatewayReachable] = useState<boolean | null>(
//     null,
//   );
//   const [gatewayWarning, setGatewayWarning] = useState<string | null>(null);
//   const [manualNumber, setManualNumber] = useState("");
//   const [elapsed, setElapsed] = useState(0);
//   const [sessionCalls, setSessionCalls] = useState(0);
//   const [postCall, setPostCall] = useState<PostCall | null>(null);

//   // post-call wrap-up form
//   const [pcDisposition, setPcDisposition] =
//     useState<CallDisposition>("connected");
//   const [pcNote, setPcNote] = useState("");
//   const [pcDispo, setPcDispo] = useState("");
//   const [pcReason, setPcReason] = useState("");
//   const [pcAmt, setPcAmt] = useState("");
//   const [pcPayDate, setPcPayDate] = useState("");
//   const [pcMode, setPcMode] = useState("");
//   const [pcSchedule, setPcSchedule] = useState(false);
//   const [pcFollowUpAt, setPcFollowUpAt] = useState("");
//   const [saving, setSaving] = useState(false);

//   const phoneRef = useRef<SipPhone | null>(null);
//   const audioRef = useRef<HTMLAudioElement | null>(null);
//   const metaRef = useRef<CallMeta | null>(null);
//   const sipRef = useRef<SipConfig | null>(null);
//   sipRef.current = sip;
//   const registeredRef = useRef(false);
//   registeredRef.current = registered;
//   const campaignRef = useRef<Campaign | null>(null);
//   campaignRef.current = campaign;
//   const autoRunningRef = useRef(false);
//   autoRunningRef.current = autoRunning;
//   const reasonNeedsPayment = pcReason.startsWith("$");

//   const handleCallState = useCallback((s: CallState) => {
//     setCallState(s);
//     if (
//       s === "in-call" &&
//       metaRef.current &&
//       metaRef.current.answeredAt === null
//     ) {
//       metaRef.current.answeredAt = Date.now();
//     }
//   }, []);

//   const handleCallEnded = useCallback(
//     (info: { answered: boolean; cause: string }) => {
//       const m = metaRef.current;
//       if (!m) return;
//       const durationSeconds = m.answeredAt
//         ? Math.round((Date.now() - m.answeredAt) / 1000)
//         : 0;
//       setPostCall({
//         phoneNumber: m.phoneNumber,
//         contactName: m.contactName,
//         campaignId: m.campaignId,
//         csvDataId: m.csvDataId,
//         durationSeconds,
//         defaultDisposition: causeToDisposition(info.answered, info.cause),
//       });
//       metaRef.current = null;
//     },
//     [],
//   );

//   // ---- init: SIP phone + assigned campaign ----
//   useEffect(() => {
//     let phone: SipPhone | null = null;
//     (async () => {
//       try {
//         const res = await fetch("/api/employee/sip");
//         const data = await res.json();
//         if (!res.ok) {
//           toast.error(data.error ?? "Could not load SIP configuration");
//           return;
//         }
//         setSip(data);
//         if (audioRef.current) {
//           phone = new SipPhone(audioRef.current, {
//             onRegistered: setRegistered,
//             onCallState: handleCallState,
//             onCallEnded: handleCallEnded,
//           });
//           phone.start({
//             wssUrl: data.wssUrl,
//             sipUri: `sip:${data.extension}@${data.sipServer}`,
//             authUser: data.extension,
//             password: data.password,
//             displayName: data.displayName,
//           });
//           phoneRef.current = phone;
//         }
//       } catch {
//         toast.error("Failed to initialise the dialer");
//       }
//     })();

//     (async () => {
//       try {
//         const res = await fetch("/api/employee/campaigns");
//         const data = await res.json();
//         if (res.ok && data.campaigns?.length) {
//           // All campaigns the agent may work (assigned + group); the first
//           // one stays auto-selected so the existing flow is unchanged.
//           setCampaigns(data.campaigns);
//           setCampaign(data.campaigns[0]);
//         }
//       } catch {
//         /* ignore */
//       } finally {
//         setCampaignsLoaded(true);
//       }
//     })();

//     return () => {
//       phone?.stop();
//     };
//   }, [handleCallState, handleCallEnded]);

//   // ---- broadcast call state for live monitoring ----
//   useEffect(() => {
//     const onCall =
//       callState === "connecting" ||
//       callState === "ringing" ||
//       callState === "in-call";
//     getSocket().emit("set-state", onCall ? "on-call" : "idle");
//   }, [callState]);

//   // ---- call timer ----
//   useEffect(() => {
//     if (
//       callState !== "connecting" &&
//       callState !== "ringing" &&
//       callState !== "in-call"
//     ) {
//       return;
//     }
//     const t = setInterval(() => {
//       if (metaRef.current) {
//         setElapsed(Math.round((Date.now() - metaRef.current.placedAt) / 1000));
//       }
//     }, 500);
//     return () => clearInterval(t);
//   }, [callState]);

//   // ---- reset wrap-up form when a new call ends ----
//   useEffect(() => {
//     if (postCall) {
//       setPcDisposition(postCall.defaultDisposition);
//       setPcNote("");
//       setPcDispo("");
//       setPcReason("");
//       setPcAmt("");
//       setPcPayDate("");
//       setPcMode("");
//       setPcSchedule(false);
//       setPcFollowUpAt("");
//     }
//   }, [postCall]);

//   function startCall(
//     phoneNumber: string,
//     contactName: string | null,
//     cId: number | null,
//     csvId: number | null,
//   ): boolean {
//     const s = sipRef.current;
//     if (!phoneRef.current || !s) return false;
//     if (!registeredRef.current) {
//       toast.warning("Phone is not registered yet");
//       return false;
//     }
//     // Block only if we have confirmed the gateway is offline (not null/unknown)
//     if (gatewayReachable === false) {
//       toast.error(gatewayWarning ?? "Gateway is offline — cannot place call");
//       return false;
//     }
//     const target = phoneNumber.trim();
//     if (!target) return false;
//     metaRef.current = {
//       placedAt: Date.now(),
//       answeredAt: null,
//       phoneNumber: target,
//       contactName,
//       campaignId: cId,
//       csvDataId: csvId,
//     };
//     setElapsed(0);
//     // Pick the first active gateway with an asterisk_endpoint for this campaign
//     const gw = campaignRef.current?.gateways?.find((g) => g.asterisk_endpoint);
//     phoneRef.current.call(
//       target,
//       s.sipServer,
//       gw?.asterisk_endpoint ?? undefined,
//     );
//     return true;
//   }

//   // ---- check gateway reachability when campaign changes ----
//   useEffect(() => {
//     if (!campaign) return;
//     fetch(`/api/employee/gateway-status?campaignId=${campaign.id}`)
//       .then((r) => r.json())
//       .then((data) => {
//         setGatewayReachable(data.reachable);
//         setGatewayWarning(
//           data.reachable ? null : (data.reason ?? "Gateway offline"),
//         );
//       })
//       .catch(() => {
//         setGatewayReachable(null);
//         setGatewayWarning(null);
//       });
//   }, [campaign]);

//   // ---- PREDICTIVE: go available + receive CONNECTED calls ----
//   // Agent ab call ORIGINATE nahi karta. Server (engine) call lagata hai,
//   // human uthata hai, tab agent ko already-connected call milti hai.
//   useEffect(() => {
//     const isAuto =
//       campaign?.dialer_type === "predictive" ||
//       campaign?.dialer_type === "ratio";
//     if (!registered || !campaign || !isAuto) return;

//     const socket = getSocket();
//     socket.emit("agent-available", {
//       extension: sipRef.current?.extension,
//       campaignId: campaign.id,
//     });
//     setAutoRunning(true);

//     const onAssigned = (c: Contact) => {
//       setContact(c);
//       // call already CONNECTED hai — wrap-up ke liye meta set karo
//       metaRef.current = {
//         placedAt: Date.now(),
//         answeredAt: Date.now(),
//         phoneNumber: c.phone_number,
//         contactName: c.name ?? null,
//         campaignId: campaign.id,
//         csvDataId: c.id,
//       };
//       setElapsed(0);
//       setCallState("in-call");
//     };
//     socket.on("assigned-call", onAssigned);
//     return () => {
//       socket.off("assigned-call", onAssigned);
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [registered, campaign]);

//   function startAuto() {
//     if (!campaign) return;
//     setComplete(false);
//     setAutoRunning(true);
//     getSocket().emit("agent-available", {
//       extension: sipRef.current?.extension,
//       campaignId: campaign.id,
//     });
//   }

//   function stopAuto() {
//     setAutoRunning(false);
//     getSocket().emit("agent-break");
//   }

//   function onHangup() {
//     phoneRef.current?.hangup();
//   }

//   const inCall =
//     callState === "connecting" ||
//     callState === "ringing" ||
//     callState === "in-call";

//   function pressKey(k: string) {
//     if (callState === "in-call") {
//       phoneRef.current?.sendDTMF(k);
//     } else if (!autoRunning && !inCall && !postCall) {
//       setManualNumber((n) => n + k);
//     }
//   }

//   function manualCall() {
//     if (manualNumber.trim()) {
//       startCall(
//         manualNumber.trim(),
//         null,
//         campaignRef.current?.id ?? null,
//         null,
//       );
//     }
//   }

//   async function savePostCall() {
//     if (!postCall) return;

//     // PTP/SETT/CBPTP (payment wale) mein amount, date, mode teeno zaroori
//     if (reasonNeedsPayment) {
//       if (!pcAmt) {
//         toast.warning("Amount zaroori hai");
//         return;
//       }
//       if (!pcPayDate) {
//         toast.warning("Payment date zaroori hai");
//         return;
//       }
//       if (!pcMode) {
//         toast.warning("Payment mode zaroori hai");
//         return;
//       }
//     }

//     setSaving(true);
//     try {
//       const reasonText = pcReason.startsWith("$")
//         ? pcReason.slice(1)
//         : pcReason;
//       const parts: string[] = [];
//       if (pcNote.trim()) parts.push(pcNote.trim());
//       if (pcDispo && reasonText) {
//         let dispoLine = `[${pcDispo} - ${reasonText}`;
//         if (reasonNeedsPayment) {
//           dispoLine += ` | amt:${pcAmt || "?"} date:${pcPayDate || "?"} mode:${pcMode || "?"}`;
//         }
//         dispoLine += `]`;
//         parts.push(dispoLine);
//       } else if (pcDispo) {
//         parts.push(`[${pcDispo}]`);
//       }
//       const composedNote = parts.length ? parts.join("\n") : null;

//       const res = await fetch("/api/employee/calls", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           phoneNumber: postCall.phoneNumber,
//           contactName: postCall.contactName,
//           campaignId: postCall.campaignId,
//           csvDataId: postCall.csvDataId,
//           status: pcDisposition,
//           durationSeconds: postCall.durationSeconds,
//           note: composedNote,
//           tags: pcDispo || null,
//           followUpAt: pcSchedule && pcFollowUpAt ? pcFollowUpAt : null,
//         }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         toast.error(data.error ?? "Could not save call");
//         return;
//       }
//       setSessionCalls((n) => n + 1);
//       setPostCall(null);
//       setCallState("idle");
//       setElapsed(0);
//       setContact(null);
//       // 🆕 wrap-up ho gaya -> wapas available, engine agli connected call dega
//       if (autoRunningRef.current) {
//         getSocket().emit("agent-available", {
//           extension: sipRef.current?.extension,
//           campaignId: campaignRef.current?.id,
//         });
//       }
//     } catch {
//       toast.error("Network error");
//     } finally {
//       setSaving(false);
//     }
//   }

//   const noCampaign = campaignsLoaded && !campaign;

//   /** Switch to another allowed campaign (only while idle, dialer stopped). */
//   function switchCampaign(id: number) {
//     const next = campaigns.find((c) => c.id === id);
//     if (!next || next.id === campaign?.id) return;
//     // pehle current campaign se break le lo
//     getSocket().emit("agent-break");
//     setAutoRunning(false);
//     setCampaign(next);
//     setComplete(false);
//   }

//   return (
//     <div className="mx-auto max-w-4xl">
//       <audio ref={audioRef} autoPlay muted={false} className="hidden" />
//       {gatewayWarning && (
//         <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
//           ⚠ {gatewayWarning} — calls are blocked until the gateway comes online.
//         </div>
//       )}
//       <div className="mb-4 flex items-center justify-between">
//         <h1 className="text-xl font-semibold">
//           {campaign
//             ? (DIALER_LABELS[campaign.dialer_type] ?? "Dialer")
//             : "Dialer"}
//         </h1>
//         <span
//           className={
//             "rounded-full px-3 py-1 text-xs font-semibold " +
//             (registered
//               ? "bg-green-100 text-green-700"
//               : "bg-red-100 text-red-700")
//           }
//         >
//           {registered ? "Phone registered" : "Connecting…"}
//         </span>
//       </div>
//       <div className="grid gap-4 md:grid-cols-2">
//         {/* ---- left: auto-dialer + customer ---- */}
//         <div className="space-y-4">
//           <div className="rounded-2xl bg-white p-5 shadow-sm">
//             {noCampaign ? (
//               <p className="text-sm text-amber-700">
//                 No campaign available. Ask your admin or team lead to add you
//                 to a group with an active campaign — it will appear here
//                 automatically once they do.
//               </p>
//             ) : (
//               <>
//                 <div className="flex items-center justify-between">
//                   <div>
//                     <p className="text-xs font-medium text-slate-400">
//                       Campaign
//                     </p>
//                     {campaigns.length > 1 ? (
//                       <select
//                         value={campaign?.id ?? ""}
//                         disabled={callState !== "idle" || autoRunning}
//                         onChange={(e) => switchCampaign(Number(e.target.value))}
//                         className="mt-0.5 rounded-lg border border-slate-300 px-2 py-1 text-sm font-semibold disabled:opacity-60"
//                         title={
//                           autoRunning
//                             ? "Stop the dialer before switching campaigns"
//                             : undefined
//                         }
//                       >
//                         {campaigns.map((c) => (
//                           <option key={c.id} value={c.id}>
//                             {c.name}
//                           </option>
//                         ))}
//                       </select>
//                     ) : (
//                       <p className="font-semibold">{campaign?.name ?? "…"}</p>
//                     )}
//                   </div>
//                   {campaign?.dialer_type === "predictive" ||
//                   campaign?.dialer_type === "ratio" ? (
//                     <span
//                       className={
//                         "rounded-full px-3 py-1 text-xs font-semibold " +
//                         (complete
//                           ? "bg-blue-100 text-blue-700"
//                           : autoRunning
//                             ? "bg-green-100 text-green-700"
//                             : "bg-slate-100 text-slate-600")
//                       }
//                     >
//                       {complete
//                         ? "Campaign complete"
//                         : autoRunning
//                           ? "Available"
//                           : "On break"}
//                     </span>
//                   ) : (
//                     <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 capitalize">
//                       {campaign?.dialer_type ?? "manual"}
//                     </span>
//                   )}
//                 </div>
//                 <div className="mt-4 flex items-center justify-between">
//                   <span className="text-sm text-slate-500">
//                     Calls this session: <b>{sessionCalls}</b>
//                   </span>
//                   {(campaign?.dialer_type === "predictive" ||
//                     campaign?.dialer_type === "ratio") &&
//                     (autoRunning ? (
//                       <button
//                         onClick={stopAuto}
//                         className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
//                       >
//                         Take break
//                       </button>
//                     ) : (
//                       <button
//                         onClick={startAuto}
//                         disabled={!registered || !campaign}
//                         className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
//                       >
//                         {complete ? "Restart" : "Go available"}
//                       </button>
//                     ))}
//                 </div>
//                 {(campaign?.dialer_type === "predictive" ||
//                   campaign?.dialer_type === "ratio") && (
//                   <p className="mt-2 text-xs text-slate-400">
//                     Server places the calls. A connected customer is dropped
//                     onto your screen — you won&apos;t see dialing or ringing.
//                     Take a break before stepping away.
//                   </p>
//                 )}
//                 {campaign?.dialer_type === "manual" && (
//                   <p className="mt-2 text-xs text-slate-400">
//                     Manual mode — use the dial pad below to call each contact.
//                   </p>
//                 )}
//                 {campaign?.dialer_type === "inbound" && (
//                   <p className="mt-2 text-xs text-slate-400">
//                     Inbound mode — waiting for incoming calls.
//                   </p>
//                 )}
//               </>
//             )}
//           </div>

//           {/* customer details */}
//           <div className="rounded-2xl bg-white p-5 shadow-sm">
//             <h2 className="mb-2 text-sm font-semibold text-slate-500">
//               Customer details
//             </h2>
//            {contact ? (
//               <div className="space-y-1 text-sm">
//                 <p className="text-lg font-semibold">
//                   {contact.name ?? "Unknown contact"}
//                 </p>
//                 <p className="font-mono text-slate-700">
//                   {contact.phone_number}
//                 </p>
//                 {asEntries(contact.custom_fields)
//                   .filter(([, val]) => val !== null && val !== "" && val !== undefined)
//                   .map(([key, val]) => (
//                     <p key={key} className="text-slate-600">
//                       <span className="font-medium text-slate-500">{key}:</span>{" "}
//                       {String(val)}
//                     </p>
//                   ))}
//               </div>
//             ) : (
//               <p className="text-sm text-slate-400">
//                 {autoRunning
//                   ? "Waiting for the next connected call…"
//                   : "No contact loaded."}
//               </p>
//             )}
//           </div>

//           {/* manual dial (ad-hoc) */}
//           <div className="rounded-2xl bg-white p-5 shadow-sm">
//             <h2 className="mb-2 text-sm font-semibold text-slate-500">
//               Manual call
//             </h2>
//             <div className="flex gap-2">
//               <input
//                 value={manualNumber}
//                 onChange={(e) => setManualNumber(e.target.value)}
//                 disabled={autoRunning || inCall}
//                 placeholder="Phone number"
//                 className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm disabled:bg-slate-50"
//               />
//               <button
//                 onClick={manualCall}
//                 disabled={
//                   autoRunning || inCall || !manualNumber.trim() || !registered
//                 }
//                 className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
//               >
//                 Call
//               </button>
//             </div>
//             <p className="mt-1 text-xs text-slate-400">
//               Available when the auto-dialer is stopped.
//             </p>
//           </div>
//         </div>

//         {/* ---- right: live call + dialpad + script ---- */}
//         <div className="space-y-4">
//           <div className="rounded-2xl bg-white p-5 shadow-sm">
//             <h2 className="mb-3 text-sm font-semibold text-slate-500">
//               Live call
//             </h2>
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-lg font-semibold">
//                   {STATE_LABEL[callState]}
//                 </p>
//                 <p className="font-mono text-sm text-slate-500">
//                   {metaRef.current?.phoneNumber || manualNumber || "—"}
//                 </p>
//               </div>
//               <div className="text-right">
//                 <p className="font-mono text-2xl">{fmt(elapsed)}</p>
//                 {callState === "in-call" && (
//                   <p className="flex items-center justify-end gap-1 text-xs text-red-600">
//                     <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-600" />
//                     Live
//                   </p>
//                 )}
//               </div>
//             </div>
//             <button
//               onClick={onHangup}
//               disabled={!inCall}
//               className="mt-3 w-full rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
//             >
//               Hang up
//             </button>
//           </div>

//           <div className="rounded-2xl bg-white p-5 shadow-sm">
//             <div className="grid grid-cols-3 gap-2">
//               {DIAL_KEYS.map((k) => (
//                 <button
//                   key={k}
//                   onClick={() => pressKey(k)}
//                   className="rounded-lg border border-slate-200 bg-slate-50 py-3 text-lg font-medium hover:bg-indigo-50"
//                 >
//                   {k}
//                 </button>
//               ))}
//             </div>
//             <p className="mt-2 text-xs text-slate-400">
//               During a call the keypad sends DTMF tones.
//             </p>
//           </div>

//           <div className="rounded-2xl bg-white p-5 shadow-sm">
//             <h2 className="mb-2 text-sm font-semibold text-slate-500">
//               Call script
//             </h2>
//             <p className="whitespace-pre-wrap text-sm text-slate-700">
//               {campaign?.script ?? "No script for this campaign."}
//             </p>
//           </div>
//         </div>
//       </div>
//       {/* ---- post-call wrap-up ---- */}
//       {postCall && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
//           <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
//             <h2 className="text-base font-semibold">Wrap up call</h2>
//             <p className="mt-0.5 text-sm text-slate-500">
//               {postCall.contactName ? postCall.contactName + " · " : ""}
//               {postCall.phoneNumber} · {fmt(postCall.durationSeconds)}
//             </p>

//             <label className="mt-4 block text-sm font-medium text-slate-700">
//               Call status
//             </label>
//             <select
//               value={pcDisposition}
//               onChange={(e) =>
//                 setPcDisposition(e.target.value as CallDisposition)
//               }
//               className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
//             >
//               {DISPOSITIONS.map((d) => (
//                 <option key={d.value} value={d.value}>
//                   {d.label}
//                 </option>
//               ))}
//             </select>

//             <label className="mt-3 block text-sm font-medium text-slate-700">
//               Notes
//             </label>
//             <textarea
//               value={pcNote}
//               onChange={(e) => setPcNote(e.target.value)}
//               rows={3}
//               className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
//               placeholder="What did you discuss?"
//             />

//             <label className="mt-3 block text-sm font-medium text-slate-700">
//               DISPO
//             </label>
//             <select
//               value={pcDispo}
//               onChange={(e) => {
//                 setPcDispo(e.target.value);
//                 setPcReason("");
//                 setPcAmt("");
//                 setPcPayDate("");
//                 setPcMode("");
//               }}
//               className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
//             >
//               <option value="">— select disposition —</option>
//               {Object.keys(DISPO_OPTIONS).map((d) => (
//                 <option key={d} value={d}>
//                   {d}
//                 </option>
//               ))}
//             </select>

//             {pcDispo && (
//               <>
//                 <label className="mt-3 block text-sm font-medium text-slate-700">
//                   Reason
//                 </label>
//                 <select
//                   value={pcReason}
//                   onChange={(e) => setPcReason(e.target.value)}
//                   className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
//                 >
//                   <option value="">— select reason —</option>
//                   {DISPO_OPTIONS[pcDispo].map((r) => (
//                     <option key={r} value={r}>
//                       {r.startsWith("$") ? r.slice(1) : r}
//                     </option>
//                   ))}
//                 </select>
//               </>
//             )}

//             {reasonNeedsPayment && (
//               <div className="mt-3 grid grid-cols-3 gap-2">
//                 <div>
//                   <label className="block text-xs font-medium text-slate-600">
//                     Amount
//                   </label>
//                   <input
//                     value={pcAmt}
//                     onChange={(e) => setPcAmt(e.target.value)}
//                     inputMode="numeric"
//                     placeholder="₹"
//                     className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-xs font-medium text-slate-600">
//                     Date
//                   </label>
//                   <input
//                     type="date"
//                     value={pcPayDate}
//                     onChange={(e) => {
//                       setPcPayDate(e.target.value);
//                       if (e.target.value) {
//                         setPcSchedule(true);
//                         setPcFollowUpAt(e.target.value + "T10:00");
//                       }
//                     }}
//                     className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-xs font-medium text-slate-600">
//                     Mode
//                   </label>
//                   <select
//                     value={pcMode}
//                     onChange={(e) => setPcMode(e.target.value)}
//                     className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
//                   >
//                     <option value="">—</option>
//                     {PAY_MODES.map((m) => (
//                       <option key={m} value={m}>
//                         {m}
//                       </option>
//                     ))}
//                   </select>
//                 </div>
//               </div>
//             )}

//             <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
//               <input
//                 type="checkbox"
//                 checked={pcSchedule}
//                 onChange={(e) => setPcSchedule(e.target.checked)}
//               />
//               Schedule a follow-up call
//             </label>
//             {pcSchedule && (
//               <input
//                 type="datetime-local"
//                 value={pcFollowUpAt}
//                 onChange={(e) => setPcFollowUpAt(e.target.value)}
//                 className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
//               />
//             )}

//             <Button
//               onClick={savePostCall}
//               loading={saving}
//               className="mt-5 w-full"
//             >
//               {saving
//                 ? "Saving…"
//                 : autoRunning
//                   ? "Save & next call"
//                   : "Save call"}
//             </Button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }


"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { getSocket } from "@/lib/useSocket";
import { Button } from "@/components/Button";
import type { Campaign, Contact, SipConfig, CallDisposition } from "@/types";

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

const DIAL_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
const DIAL_SUB: Record<string, string> = {
  "2": "ABC", "3": "DEF", "4": "GHI", "5": "JKL",
  "6": "MNO", "7": "PQRS", "8": "TUV", "9": "WXYZ",
};

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

const DISPO_OPTIONS: Record<string, string[]> = {
  PAID: ["Full Paid", "Settlement Paid", "Partial Paid"],
  PC: ["On the way (Branch)", "On the way (Bank)", "Customer doing online Payment"],
  PTP: ["$Customer ready to pay"],
  CBPTP: ["$Future PTP"],
  SETT: ["$Customer ready to pay settlement"],
  BPTP: ["Excuse - asking days for payment", "Emergency Reason / Death / Accident"],
  CB: ["Customer in Emergency", "Call back later", "Out of station", "Other", "Statement verification"],
  FI: ["PFI-Permanent - Unemployed / Out of job", "SFI-Short Term - Business Issue", "Vehicle Viability / EMI Affordability"],
  NFI: ["CUACC-Customer Met with Accident", "VEHAC-Vehicle Met with Accident", "MEDIS-Medical Issue", "FMEXP-Death of Family Member"],
  SI: ["NORC-RC Copy not Received", "TISSU-Technical Issue in Vehicle", "EMIDP-EMI or DP Issue"],
  TNC: ["Ringing", "Not Reachable", "Switch off", "Number busy", "Beep Silence", "No voice / Voice issue"],
  SKIP: ["MIGR-Customer Migrated / Shift", "CUNA-Not Available at visit place", "FRAUD-Fraud Case"],
  LM: ["Left Message"],
  LPR: ["Language Problem"],
  LN: ["Legal Notice"],
  PTV: ["Pick the Vehicle"],
  WN: ["Wrong Number"],
  ID: ["Intentional Defaulter"],
  VPC: ["Vehicle under police custody"],
  VDLR: ["Vehicle with dealer"],
  CD: ["Call drop"],
  Repo: ["Vehicle Repo"],
  Account: ["Account Close"],
};

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
}

interface PostCall {
  phoneNumber: string;
  contactName: string | null;
  campaignId: number | null;
  csvDataId: number | null;
  durationSeconds: number;
  defaultDisposition: CallDisposition;
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
  const autoRunningRef = useRef(false);
  autoRunningRef.current = autoRunning;
  const reasonNeedsPayment = pcReason.startsWith("$");

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
        durationSeconds,
        defaultDisposition: causeToDisposition(info.answered, info.cause),
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
    };
    setElapsed(0);
    const gw = campaignRef.current?.gateways?.find((g) => g.asterisk_endpoint);
    phoneRef.current.call(target, s.sipServer, gw?.asterisk_endpoint ?? undefined);
    return true;
  }

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
    const isAuto = campaign?.dialer_type === "predictive" || campaign?.dialer_type === "ratio";
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

  const inCall = callState === "connecting" || callState === "ringing" || callState === "in-call";

  function pressKey(k: string) {
    if (callState === "in-call") phoneRef.current?.sendDTMF(k);
    else if (!autoRunning && !inCall && !postCall) setManualNumber((n) => n + k);
  }

  function manualCall() {
    if (manualNumber.trim()) {
      startCall(manualNumber.trim(), null, campaignRef.current?.id ?? null, null);
    }
  }

  async function savePostCall() {
    if (!postCall) return;
    if (reasonNeedsPayment) {
      if (!pcAmt) { toast.warning("Amount zaroori hai"); return; }
      if (!pcPayDate) { toast.warning("Payment date zaroori hai"); return; }
      if (!pcMode) { toast.warning("Payment mode zaroori hai"); return; }
    }

    setSaving(true);
    try {
      const reasonText = pcReason.startsWith("$") ? pcReason.slice(1) : pcReason;
      const parts: string[] = [];
      if (pcNote.trim()) parts.push(pcNote.trim());
      if (pcDispo && reasonText) {
        let dispoLine = `[${pcDispo} - ${reasonText}`;
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
          status: pcDisposition,
          durationSeconds: postCall.durationSeconds,
          note: composedNote,
          tags: pcDispo || null,
          followUpAt: pcSchedule && pcFollowUpAt ? pcFollowUpAt : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Could not save call"); return; }
      setSessionCalls((n) => n + 1);
      setPostCall(null);
      setCallState("idle");
      setElapsed(0);
      setContact(null);
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
    setCampaign(next);
    setComplete(false);
  }

  const isAutoCampaign = campaign?.dialer_type === "predictive" || campaign?.dialer_type === "ratio";
  const customEntries = contact ? asEntries(contact.custom_fields).filter(([, v]) => v !== null && v !== "" && v !== undefined) : [];

  return (
    <div className="mx-auto max-w-6xl">
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

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Phone className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              {campaign ? (DIALER_LABELS[campaign.dialer_type] ?? "Dialer") : "Dialer"}
            </h1>
            <p className="text-xs text-slate-500">
              {sip?.extension ? `Ext ${sip.extension}` : "Loading…"}
            </p>
          </div>
        </div>
        <span
          className={
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset " +
            (registered
              ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
              : "bg-rose-50 text-rose-700 ring-rose-600/20")
          }
        >
          <span className={"h-1.5 w-1.5 rounded-full " + (registered ? "bg-emerald-500" : "bg-rose-500 animate-pulse")} />
          {registered ? "Phone registered" : "Connecting…"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ===== LEFT COLUMN ===== */}
        <div className="space-y-4">
          {/* Campaign card */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
            {noCampaign ? (
              <div className="flex items-start gap-2 text-sm text-amber-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  No campaign available. Ask your admin or team lead to add you
                  to a group with an active campaign — it will appear here
                  automatically once they do.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Campaign
                    </p>
                    {campaigns.length > 1 ? (
                      <select
                        value={campaign?.id ?? ""}
                        disabled={callState !== "idle" || autoRunning}
                        onChange={(e) => switchCampaign(Number(e.target.value))}
                        className="mt-1 w-full max-w-full truncate rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60"
                        title={autoRunning ? "Stop the dialer before switching campaigns" : undefined}
                      >
                        {campaigns.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                        {campaign?.name ?? "…"}
                      </p>
                    )}
                  </div>
                  {isAutoCampaign ? (
                    <span
                      className={
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset " +
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
                    <span className="inline-flex shrink-0 items-center rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-inset ring-slate-500/20">
                      {campaign?.dialer_type ?? "manual"}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-500">
                    Calls this session
                    <span className="ml-1.5 tabular-nums font-semibold text-slate-900">
                      {sessionCalls}
                    </span>
                  </span>
                  {isAutoCampaign &&
                    (autoRunning ? (
                      <button
                        onClick={stopAuto}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
                      >
                        <Coffee className="h-3.5 w-3.5" />
                        Take break
                      </button>
                    ) : (
                      <button
                        onClick={startAuto}
                        disabled={!registered || !campaign}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Play className="h-3.5 w-3.5" />
                        {complete ? "Restart" : "Go available"}
                      </button>
                    ))}
                </div>

                {isAutoCampaign && (
                  <p className="mt-2 text-xs text-slate-400">
                    Server places the calls. A connected customer is dropped onto your screen — you won&apos;t see dialing or ringing. Take a break before stepping away.
                  </p>
                )}
                {campaign?.dialer_type === "manual" && (
                  <p className="mt-2 text-xs text-slate-400">
                    Manual mode — use the dial pad to call each contact.
                  </p>
                )}
                {campaign?.dialer_type === "inbound" && (
                  <p className="mt-2 text-xs text-slate-400">
                    Inbound mode — waiting for incoming calls.
                  </p>
                )}
              </>
            )}
          </div>

          {/* ==== COMPACT INLINE CUSTOMER DETAILS ==== */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
            {contact ? (
              <div className="space-y-2.5">
                {/* Top row: avatar + name + phone (all on one line) */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white shadow-sm">
                    {initialsOf(contact.name, contact.phone_number)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {contact.name ?? "Unknown contact"}
                    </p>
                    <p className="font-mono text-xs text-slate-500">
                      {contact.phone_number}
                    </p>
                  </div>
                  <span className="ml-auto inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                    Customer
                  </span>
                </div>

                {/* Custom fields as compact chips — wraps to as few lines as possible */}
                {customEntries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
                    {customEntries.map(([key, val]) => (
                      <div
                        key={key}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-[11px] ring-1 ring-inset ring-slate-200"
                      >
                        <span className="font-medium uppercase tracking-wide text-slate-500">
                          {key}
                        </span>
                        <span className="truncate font-medium text-slate-800">
                          {String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2.5 text-sm text-slate-400">
                <User className="h-4 w-4" />
                <span>
                  {autoRunning
                    ? "Waiting for the next connected call…"
                    : "No contact loaded."}
                </span>
              </div>
            )}
          </div>

          {/* Manual call */}
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
        </div>

        {/* ===== RIGHT COLUMN ===== */}
        <div className="space-y-4">
          {/* Live call */}
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Live call
              </p>
              {callState === "in-call" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300 ring-1 ring-inset ring-rose-400/30">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
                  Live
                </span>
              )}
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xl font-semibold tracking-tight">
                  {STATE_LABEL[callState]}
                </p>
                <p className="mt-0.5 truncate font-mono text-sm text-slate-400">
                  {metaRef.current?.phoneNumber || manualNumber || "—"}
                </p>
              </div>
              <p className="font-mono text-3xl font-semibold tabular-nums">
                {fmt(elapsed)}
              </p>
            </div>
            <button
              onClick={onHangup}
              disabled={!inCall}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <PhoneOff className="h-4 w-4" />
              Hang up
            </button>
          </div>

          {/* Dialpad */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
            <div className="grid grid-cols-3 gap-2">
              {DIAL_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => pressKey(k)}
                  className="group flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-2.5 transition hover:border-indigo-300 hover:bg-indigo-50 active:scale-95"
                >
                  <span className="text-xl font-semibold leading-none text-slate-900 group-hover:text-indigo-700">
                    {k}
                  </span>
                  {DIAL_SUB[k] && (
                    <span className="mt-0.5 text-[9px] font-semibold tracking-widest text-slate-400">
                      {DIAL_SUB[k]}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] text-slate-400">
              During a call the keypad sends DTMF tones.
            </p>
          </div>

          {/* Call script */}
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

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Notes
                </label>
                <textarea
                  value={pcNote}
                  onChange={(e) => setPcNote(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="What did you discuss?"
                />
              </div>

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
                  {Object.keys(DISPO_OPTIONS).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {pcDispo && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Reason
                  </label>
                  <select
                    value={pcReason}
                    onChange={(e) => setPcReason(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">— select reason —</option>
                    {DISPO_OPTIONS[pcDispo].map((r) => (
                      <option key={r} value={r}>
                        {r.startsWith("$") ? r.slice(1) : r}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

              <div className="rounded-xl border border-slate-200 p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={pcSchedule}
                    onChange={(e) => setPcSchedule(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Schedule a follow-up call
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
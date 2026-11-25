"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Phone, History, User, Pencil, CheckCircle2 } from "lucide-react";
import { useEscapeKey } from "@/lib/useEscapeKey";

/** custom_fields key the agent's alternative number is stored under. */
const ALT_FIELD = "Alt Number";
const isAltKey = (k: string) => k.trim().toLowerCase() === ALT_FIELD.toLowerCase();

/** Turn a record's custom_fields (object or [label,value] array) into pairs. */
function toFieldPairs(raw: unknown): [string, string][] {
  let parsed: unknown = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  let pairs: [string, unknown][] = [];
  if (Array.isArray(parsed)) {
    pairs = parsed
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map((p) => [String((p as unknown[])[0]), (p as unknown[])[1]] as [string, unknown]);
  } else if (parsed && typeof parsed === "object") {
    pairs = Object.entries(parsed as Record<string, unknown>);
  }
  return pairs
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([k, v]) => [k, String(v)] as [string, string]);
}

export interface SearchResult {
  id: number | null;
  phone: string;
  name: string | null;
  email: string | null;
  company: string | null;
  campaign: string | null;
  list: string | null;
  status: string | null;
  fields: [string, string][];
  calls: number;
  last_call_at: string | null;
  in_data: boolean;
}

function initialsOf(name: string | null, fallback: string) {
  if (!name) return fallback.slice(-2);
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * One box to look a customer up by phone, name or loan number — across every
 * campaign and group, and through the call history. Each hit shows the whole
 * record, with Call and History to hand.
 */
export function CustomerSearchModal({
  initialQuery = "",
  canCall,
  callHint,
  onCall,
  onHistory,
  onSaveAlt,
  onSaveFields,
  onClose,
}: {
  initialQuery?: string;
  /** Calling is possible right now (phone registered, no live call, gateway ok). */
  canCall: boolean;
  /** Why calling is unavailable, shown on the disabled button. */
  callHint?: string;
  /** Dial a number for this customer; the whole record is passed so the
   *  dialer can show the customer on screen during the call. */
  onCall: (phone: string, result: SearchResult) => void;
  onHistory: (phone: string, name: string | null) => void;
  /** Persist an alternative number against a lead; resolves false on failure. */
  onSaveAlt: (leadId: number, altNumber: string) => Promise<boolean>;
  /** Persist edited fields/name against a lead; resolves the updated record or null. */
  onSaveFields: (
    leadId: number,
    fields: Record<string, string>,
    name: string,
  ) => Promise<{ custom_fields: unknown; name?: string | null } | null>;
  onClose: () => void;
}) {
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null); // expanded card's phone
  const [alt, setAlt] = useState<Record<string, string>>({}); // phone -> alt number box
  const [savingAlt, setSavingAlt] = useState<string | null>(null); // phone being saved
  const [editPhone, setEditPhone] = useState<string | null>(null); // card being edited
  const [editVals, setEditVals] = useState<[string, string][]>([]); // field edits
  const [editName, setEditName] = useState("");
  const [savingFields, setSavingFields] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /** Open the field editor for one result, seeded from its record. */
  function startEdit(r: SearchResult) {
    setEditName(r.name ?? "");
    setEditVals(r.fields.filter(([k]) => !isAltKey(k)).map(([k, v]) => [k, v]));
    setEditPhone(r.phone);
  }

  /** Save edited fields, refresh the card in place, and close the editor. */
  async function saveEdit(r: SearchResult) {
    if (r.id === null || savingFields) return;
    setSavingFields(true);
    try {
      const fields: Record<string, string> = {};
      for (const [k, v] of editVals) fields[k] = v;
      const updated = await onSaveFields(r.id, fields, editName);
      if (!updated) return; // the handler already reported the failure
      const pairs = toFieldPairs(updated.custom_fields);
      setResults((prev) =>
        prev
          ? prev.map((x) =>
              x.phone === r.phone
                ? {
                    ...x,
                    name: updated.name ?? x.name,
                    fields: pairs,
                  }
                : x,
            )
          : prev,
      );
      setEditPhone(null);
    } finally {
      setSavingFields(false);
    }
  }

  // Seed each result's alt box from whatever is already stored on the record.
  useEffect(() => {
    if (!results) return;
    const seed: Record<string, string> = {};
    for (const r of results) {
      const found = r.fields.find(([k]) => isAltKey(k));
      if (found) seed[r.phone] = found[1];
    }
    setAlt(seed);
    setEditPhone(null); // a fresh result set closes any open editor
  }, [results]);

  useEscapeKey(true, onClose);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Debounced search — short queries are ignored server-side anyway.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }
    let stale = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/employee/search?q=${encodeURIComponent(term)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (stale) return;
        if (!res.ok) throw new Error(json.error ?? "Search failed");
        setResults(json.results ?? []);
        setError(null);
      } catch (e: any) {
        if (!stale) {
          setError(e?.message ?? "Search failed");
          setResults(null);
        }
      } finally {
        if (!stale) setLoading(false);
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 pt-[6vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search field */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by loan number, phone or name…"
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="min-h-[8rem] space-y-2 overflow-y-auto px-4 py-3">
          {q.trim().length < 2 && (
            <p className="px-1 py-6 text-center text-sm text-slate-400">
              Type at least 2 characters — loan number, phone or name. Results span
              every campaign and the full call history.
            </p>
          )}
          {q.trim().length >= 2 && loading && !results && (
            <p className="px-1 py-6 text-center text-sm text-slate-400">Searching…</p>
          )}
          {error && <p className="px-1 py-6 text-center text-sm text-red-600">{error}</p>}
          {results && results.length === 0 && !loading && (
            <p className="px-1 py-6 text-center text-sm text-slate-400">
              No customer found for “{q.trim()}”.
            </p>
          )}

          {results?.map((r) => {
            const isOpen = open === r.phone;
            return (
              <div
                key={r.phone}
                className="rounded-xl border border-slate-200 transition hover:border-slate-300"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : r.phone)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-semibold text-white">
                    {initialsOf(r.name, r.phone)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {r.name ?? "Unknown contact"}
                    </span>
                    <span className="block truncate font-mono text-xs text-slate-500">
                      {r.phone}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {r.campaign ? (
                      <span className="max-w-[9rem] truncate rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                        {r.campaign}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        History only
                      </span>
                    )}
                    {r.calls > 0 && (
                      <span className="text-[10px] text-slate-400">
                        {r.calls} {r.calls === 1 ? "call" : "calls"}
                      </span>
                    )}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-3 py-3">
                    {/* Record details */}
                    {(r.list || r.status || r.email || r.company) && (
                      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {r.list && <span>List: <span className="text-slate-700">{r.list}</span></span>}
                        {r.status && <span>Status: <span className="text-slate-700">{r.status}</span></span>}
                        {r.company && <span>Company: <span className="text-slate-700">{r.company}</span></span>}
                        {r.email && <span>Email: <span className="text-slate-700">{r.email}</span></span>}
                      </div>
                    )}

                    {editPhone === r.phone ? (
                      /* Edit mode — change the name and any field, saved to the DB */
                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                            Name
                          </label>
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          />
                        </div>
                        {editVals.length > 0 && (
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {editVals.map(([k, v], i) => (
                              <div key={k} className="min-w-0">
                                <label
                                  className="block truncate text-[10px] font-medium uppercase tracking-wide text-slate-500"
                                  title={k}
                                >
                                  {k}
                                </label>
                                <input
                                  value={v}
                                  onChange={(e) =>
                                    setEditVals((prev) =>
                                      prev.map((p, idx) => (idx === i ? [p[0], e.target.value] : p)),
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(r)}
                            disabled={savingFields}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {savingFields ? "Saving…" : "Save changes"}
                          </button>
                          <button
                            onClick={() => setEditPhone(null)}
                            disabled={savingFields}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                          >
                            <X className="h-4 w-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : r.fields.filter(([k]) => !isAltKey(k)).length > 0 ? (
                      <div>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {r.fields.filter(([k]) => !isAltKey(k)).map(([k, v]) => (
                            <div
                              key={k}
                              className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-1.5 ring-1 ring-inset ring-slate-200"
                            >
                              <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-500">
                                {k}
                              </p>
                              <p className="truncate text-sm font-medium text-slate-800" title={v}>
                                {v}
                              </p>
                            </div>
                          ))}
                        </div>
                        {r.id !== null && (
                          <button
                            onClick={() => startEdit(r)}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Pencil className="h-4 w-4" />
                            Edit details
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="flex items-center gap-1.5 text-xs text-slate-400">
                        <User className="h-3.5 w-3.5" />
                        No stored record — known from the call history only.
                      </p>
                    )}

                    {/* Alternative number — fill a second number in by hand,
                        save it to the record (live leads only) and dial it. */}
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <div className="min-w-[10rem] flex-1">
                        <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          Alternative number
                        </label>
                        <input
                          value={alt[r.phone] ?? ""}
                          onChange={(e) => setAlt((m) => ({ ...m, [r.phone]: e.target.value }))}
                          placeholder="Add another number"
                          inputMode="tel"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                      {r.id !== null && (
                        <button
                          onClick={async () => {
                            setSavingAlt(r.phone);
                            await onSaveAlt(r.id as number, alt[r.phone] ?? "");
                            setSavingAlt(null);
                          }}
                          disabled={savingAlt === r.phone}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {savingAlt === r.phone ? "Saving…" : "Save"}
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          const num = (alt[r.phone] ?? "").trim();
                          if (!num) return;
                          // Remember it against the lead before dialing out.
                          if (r.id !== null) {
                            setSavingAlt(r.phone);
                            await onSaveAlt(r.id, alt[r.phone] ?? "");
                            setSavingAlt(null);
                          }
                          onCall(num, r);
                        }}
                        disabled={!canCall || !(alt[r.phone] ?? "").trim() || savingAlt === r.phone}
                        title={!canCall ? callHint : undefined}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Phone className="h-4 w-4" />
                        Call alt
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      <button
                        onClick={() => onCall(r.phone, r)}
                        disabled={!canCall}
                        title={!canCall ? callHint : undefined}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Phone className="h-4 w-4" />
                        Call main
                      </button>
                      <button
                        onClick={() => onHistory(r.phone, r.name)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <History className="h-4 w-4" />
                        History
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

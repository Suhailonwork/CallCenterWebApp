"use client";
import {
  DEFAULT_LIST_FIELDS,
  isDefaultField,
  normFieldName,
} from "@/lib/listFields";

/**
 * Editor for a list's field layout.
 *  - The 24 mandatory DEFAULT fields are shown locked (can't be renamed,
 *    removed or reordered) and always come first.
 *  - Below them the user adds/edits/reorders unlimited CUSTOM fields.
 * `fields` is the full ordered array (defaults + custom); `onChange` returns
 * the same shape with the defaults preserved in front.
 */
export function FieldsEditor({
  fields,
  onChange,
}: {
  fields: string[];
  onChange: (next: string[]) => void;
}) {
  const defaults = fields.filter((f) => isDefaultField(f));
  // If the incoming list is missing some defaults (legacy), fall back to the
  // canonical set for the locked display so all 24 are always visible.
  const lockedDisplay = defaults.length >= DEFAULT_LIST_FIELDS.length ? defaults : DEFAULT_LIST_FIELDS;
  const custom = fields.filter((f) => !isDefaultField(f));

  function emit(nextCustom: string[]) {
    onChange([...lockedDisplay, ...nextCustom]);
  }

  // Which custom rows duplicate a default or an earlier field (case-insensitive).
  function isDup(i: number): boolean {
    const n = normFieldName(custom[i]);
    if (!n) return false;
    if (isDefaultField(custom[i])) return true;
    return custom.slice(0, i).some((c) => normFieldName(c) === n);
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {lockedDisplay.length} default fields (always included)
        </p>
        <div className="flex flex-wrap gap-1">
          {lockedDisplay.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200"
              title="Default field — locked"
            >
              🔒 {f}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Custom fields
        </p>
        {custom.length === 0 ? (
          <p className="text-xs text-slate-400">
            None yet — add the extra columns you want stored from CSV uploads.
            Only fields listed here (matched by name, ignoring case/spaces/_/-)
            are imported; unmatched CSV columns are ignored.
          </p>
        ) : (
          <div className="space-y-1.5">
            {custom.map((f, i) => {
              const dup = isDup(i);
              return (
                <div key={i} className="flex items-center gap-1">
                  <span className="w-5 shrink-0 text-right text-xs text-slate-400">
                    {i + 1}.
                  </span>
                  <input
                    value={f}
                    onChange={(e) =>
                      emit(custom.map((c, j) => (j === i ? e.target.value : c)))
                    }
                    placeholder="Custom field name"
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-sm ${
                      dup ? "border-red-400 bg-red-50" : "border-slate-300"
                    }`}
                    title={dup ? "Duplicate field name — it will be ignored on save" : ""}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (i === 0) return;
                      const next = custom.slice();
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      emit(next);
                    }}
                    disabled={i === 0}
                    className="rounded-lg border border-slate-200 px-1.5 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-30"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (i === custom.length - 1) return;
                      const next = custom.slice();
                      [next[i + 1], next[i]] = [next[i], next[i + 1]];
                      emit(next);
                    }}
                    disabled={i === custom.length - 1}
                    className="rounded-lg border border-slate-200 px-1.5 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-30"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => emit(custom.filter((_, j) => j !== i))}
                    className="rounded-lg border border-red-200 px-1.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    title="Remove field"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() => emit([...custom, ""])}
          className="mt-1.5 rounded-lg border border-indigo-300 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
        >
          + Add custom field
        </button>
      </div>
    </div>
  );
}

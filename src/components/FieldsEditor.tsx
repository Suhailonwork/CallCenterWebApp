"use client";

/**
 * Editor for a list's ordered custom fields (VICIdial-style list layout).
 * The order matters — it's how the columns appear on the agent's card — so
 * rows can be moved up/down. An empty list means "store every CSV column".
 * Matching to CSV headers is trim + collapse-spaces + case-insensitive, so
 * "Mobile NO" here fills a "mobile no" / "MOBILE  NO" CSV column.
 */
export function FieldsEditor({
  fields,
  onChange,
}: {
  fields: string[];
  onChange: (next: string[]) => void;
}) {
  function setAt(i: number, v: string) {
    onChange(fields.map((f, j) => (j === i ? v : f)));
  }
  function removeAt(i: number) {
    onChange(fields.filter((_, j) => j !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = fields.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function add() {
    onChange([...fields, ""]);
  }

  return (
    <div className="space-y-1.5">
      {fields.length === 0 ? (
        <p className="text-xs text-slate-400">
          No custom fields — every CSV column will be stored as-is.
        </p>
      ) : (
        fields.map((f, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="w-5 shrink-0 text-right text-xs text-slate-400">
              {i + 1}.
            </span>
            <input
              value={f}
              onChange={(e) => setAt(i, e.target.value)}
              placeholder="Field name (e.g. Mobile NO)"
              className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="rounded-lg border border-slate-200 px-1.5 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-30"
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === fields.length - 1}
              className="rounded-lg border border-slate-200 px-1.5 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-30"
              title="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="rounded-lg border border-red-200 px-1.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              title="Remove field"
            >
              ✕
            </button>
          </div>
        ))
      )}
      <button
        type="button"
        onClick={add}
        className="rounded-lg border border-indigo-300 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
      >
        + Add field
      </button>
    </div>
  );
}

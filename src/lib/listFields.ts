/**
 * Isomorphic (no DB / server-only imports) helpers for a list's field layout.
 * Imported by both the API routes and the React components so the "mandatory
 * default fields" rule is defined in exactly one place.
 *
 * Model: `lists.fields` is an ordered array — the 24 mandatory DEFAULT fields
 * FIRST (locked: can't be renamed, removed or reordered), then any number of
 * custom fields the user (or a CSV upload) adds. Two default fields are
 * "dedicated": their values live in real csv_data columns, not custom_fields.
 */

/** The 24 mandatory fields every list must carry, in their fixed order. */
export const DEFAULT_LIST_FIELDS: string[] = [
  'Customer Name',
  'Mobile No',
  'Ref - No',
  'Address',
  'City',
  'State',
  'POST CODE',
  'Product',
  'Product Dis',
  'REG NO',
  'DPD',
  'LMPD',
  'LPC',
  'CBC',
  'Tenure',
  'Dealer Name',
  'Process Name',
  'Ref - 1 Name',
  'Ref_2 Name',
  'Ref_2 No',
  'M_Data',
  'Other',
  'Toss',
  'Title (Priority Data)',
];

/**
 * Canonical match key for a field / CSV header: lowercase, with spaces, `_`
 * and `-` removed. So "Ref - No" ≡ "ref_no" ≡ "REFNO" ≡ "Ref-No". Used for
 * matching CSV columns to list fields, default-field detection, and dedupe.
 */
export function normFieldName(s: string): string {
  return String(s ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

const DEFAULT_NORMS = new Set(DEFAULT_LIST_FIELDS.map(normFieldName));

export function isDefaultField(name: string): boolean {
  return DEFAULT_NORMS.has(normFieldName(name));
}

/**
 * Fields whose value is stored in a dedicated csv_data column (name /
 * phone_number) instead of custom_fields — they still appear in the list's
 * field layout, but the upload routes them to their own column so the agent's
 * card shows them once, not duplicated in the custom chips.
 */
// Keyed by normFieldName (spaces/_/- removed).
export const DEDICATED_FIELD_TO_COLUMN: Record<string, 'name' | 'phone_number'> = {
  customername: 'name',
  mobileno: 'phone_number',
};

export function isDedicatedField(name: string): boolean {
  return normFieldName(name) in DEDICATED_FIELD_TO_COLUMN;
}

/**
 * Canonical field list for a list: the 24 defaults FIRST (exact spelling &
 * order, always present), then the caller's custom fields — trimmed, blanks
 * dropped, de-duplicated case-insensitively (a custom field that collides
 * with a default or an earlier custom field is discarded). Enforced on every
 * write so the mandatory defaults can never be lost, reordered or renamed.
 */
export function composeListFields(input: readonly string[] | null | undefined): string[] {
  const out = [...DEFAULT_LIST_FIELDS];
  const seen = new Set(out.map(normFieldName));
  for (const raw of input ?? []) {
    const s = String(raw ?? '').trim();
    if (!s) continue;
    const n = normFieldName(s);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(s);
  }
  return out;
}

/** The custom (non-default) tail of a composed field list. */
export function customFieldsOf(fields: readonly string[]): string[] {
  return fields.filter((f) => !isDefaultField(f));
}

/**
 * The fields whose values belong in custom_fields — i.e. everything except the
 * dedicated fields (Customer Name / Mobile No), preserving order.
 */
export function customFieldColumns(fields: readonly string[]): string[] {
  return fields.filter((f) => !isDedicatedField(f));
}

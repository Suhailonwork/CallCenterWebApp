/** Parse CSV text into rows of string cells. Handles quoted fields. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/**
 * Normalize a CSV header / template column name for matching:
 * trim, collapse internal whitespace runs to one space, case-insensitive.
 * ("Mobile  NO " ≡ "mobile no" ≡ "MOBILE NO")
 */
export function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Find phone / name / email / company column indexes from a header row. */
export function mapColumns(header: string[]) {
  const idx = { phone: -1, name: -1, email: -1, company: -1 };
  header.forEach((h, i) => {
    const k = h.trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (
      idx.phone < 0 &&
      // 🔸 'mobileno' etc. so the Data Templates' "Mobile NO" column is the
      // dialed number (see db/seed-templates.mjs).
      ['phone', 'phonenumber', 'mobile', 'number', 'mobileno', 'mobilenumber', 'phoneno', 'contactno', 'contactnumber'].includes(k)
    ) {
      idx.phone = i;
    } else if (
      idx.name < 0 &&
      // 🔸 added 'customername' so your "Customer Name" column is detected
      ['name', 'contact', 'contactname', 'fullname', 'customername'].includes(k)
    ) {
      idx.name = i;
    } else if (idx.email < 0 && k === 'email') {
      idx.email = i;
    } else if (
      idx.company < 0 &&
      ['company', 'organization', 'organisation'].includes(k)
    ) {
      idx.company = i;
    }
  });
  return idx;
}

// 🔸 NEW FUNCTION — turns every other column into the custom_fields object
export function buildCustomFields(
  header: string[],
  row: string[],
  idx: ReturnType<typeof mapColumns>,
): Record<string, string> {
  const core = new Set([idx.phone, idx.name, idx.email, idx.company]);
  const out: Record<string, string> = {};
  header.forEach((col, i) => {
    if (core.has(i)) return;
    const val = (row[i] ?? '').trim();
    if (val !== '') out[col.trim()] = val;
  });
  return out;
}

/**
 * Build custom_fields for a campaign that has a Data Table selected.
 * Only the table's columns are stored, in the table's exact order, with the
 * table's column name as the key. CSV headers are matched case-insensitively
 * (and trimmed). Columns missing from the CSV (or with an empty cell) are
 * skipped so the agent's customer card stays clean.
 *
 * Returns an ORDERED array of [column, value] pairs rather than an object,
 * because MySQL JSON *objects* re-sort their keys on storage (by key length,
 * then bytes) which would destroy the table's column order. JSON *arrays*
 * preserve element order, so the agent sees the columns exactly as defined.
 * The Dialer renders both this array shape and the legacy object shape.
 */
export function buildCustomFieldsForTable(
  header: string[],
  row: string[],
  columns: string[],
): [string, string][] {
  // Map normalized header name -> column index (first occurrence wins).
  // Matching is trim + collapse-spaces + case-insensitive (normalizeHeader),
  // so "Customer  Name" in a CSV still fills the template's "Customer Name".
  const norm = normalizeHeader;
  const headerIndex = new Map<string, number>();
  header.forEach((h, i) => {
    const k = norm(h);
    if (!headerIndex.has(k)) headerIndex.set(k, i);
  });

  const out: [string, string][] = [];
  for (const col of columns) {
    const i = headerIndex.get(norm(col));
    if (i === undefined) continue;
    const val = (row[i] ?? '').trim();
    if (val !== '') out.push([col, val]);
  }
  return out;
}
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

/** Find phone / name / email / company column indexes from a header row. */
export function mapColumns(header: string[]) {
  const idx = { phone: -1, name: -1, email: -1, company: -1 };
  header.forEach((h, i) => {
    const k = h.trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (idx.phone < 0 && ['phone', 'phonenumber', 'mobile', 'number'].includes(k)) {
      idx.phone = i;
    } else if (
      idx.name < 0 &&
      ['name', 'contact', 'contactname', 'fullname'].includes(k)
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

export type CsvParsed = {
  headers: string[];
  rows: Record<string, string>[];
};

export function parseCsv(text: string): CsvParsed {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const records = parseRecords(text);

  let headerIdx = 0;
  while (
    headerIdx < records.length &&
    records[headerIdx].filter((c) => c.trim() !== "").length < 2
  ) {
    headerIdx++;
  }
  if (headerIdx >= records.length) return { headers: [], rows: [] };

  const headers = records[headerIdx].map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < records.length; i++) {
    const r = records[i];
    if (r.length === 1 && r[0].trim() === "") continue;
    if (r.every((c) => c.trim() === "")) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (r[j] ?? "").trim();
    }
    rows.push(row);
  }
  return { headers, rows };
}

function parseRecords(text: string): string[][] {
  const records: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cur.push(field);
      field = "";
    } else if (ch === "\r") {
      // skip
    } else if (ch === "\n") {
      cur.push(field);
      records.push(cur);
      cur = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || cur.length > 0) {
    cur.push(field);
    records.push(cur);
  }
  return records;
}

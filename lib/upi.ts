import { parseCsv } from "./csv";
import { looksBinary, looksHtml } from "./detect";
import type { Transaction } from "./types";

const DATE_HEADERS = /^(date|datetime|timestamp|transaction\s*date|txn\s*date|posting\s*date|value\s*date|completed)$/i;
const TIME_HEADERS = /^(time|transaction\s*time|txn\s*time)$/i;
const AMOUNT_HEADERS = /^(amount|amt|transaction\s*amount|txn\s*amount|value)$/i;
const DEBIT_HEADERS = /^(debit|withdrawal|withdraw|paid|sent|spent|out|debit\s*amount|withdrawal\s*amount)$/i;
const CREDIT_HEADERS = /^(credit|deposit|received|in|credit\s*amount|deposit\s*amount)$/i;
const TYPE_HEADERS = /^(type|txn\s*type|transaction\s*type|dr\/cr|drcr|cr\/dr|crdr)$/i;
const MERCHANT_HEADERS = /^(merchant|payee|to|from|name|description|narration|details|particulars|note|remark|reference|payee\s*name|merchant\s*name|transaction\s*details|transaction\s*description|transaction\s*remarks?|transaction\s*narration)$/i;

function normHeader(h: string): string {
  return h
    .replace(/[._-]/g, " ")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findHeader(headers: string[], pattern: RegExp): string | null {
  return headers.find((h) => pattern.test(normHeader(h))) ?? null;
}

function parseAmount(s: string): number {
  if (!s) return 0;
  const trimmed = s.trim();
  const cleaned = trimmed.replace(/[₹$€£,\s]/g, "");
  const isNeg = /^\(.*\)$/.test(trimmed) || cleaned.startsWith("-");
  const num = parseFloat(cleaned.replace(/[()-]/g, ""));
  if (isNaN(num)) return 0;
  return isNeg ? -num : num;
}

function parseDateTime(dateStr: string, timeStr?: string): Date | null {
  if (!dateStr) return null;
  const combined = timeStr && timeStr.trim() ? `${dateStr.trim()} ${timeStr.trim()}` : dateStr.trim();

  const native = new Date(combined);
  if (!isNaN(native.getTime())) return native;

  const m = combined.match(
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(am|pm)?$/i
  );
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    let hour = m[4] ? parseInt(m[4], 10) : 0;
    const minute = m[5] ? parseInt(m[5], 10) : 0;
    const second = m[6] ? parseInt(m[6], 10) : 0;
    const ampm = m[7]?.toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    const d = new Date(year, month, day, hour, minute, second);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

export type UpiParseResult = {
  transactions: Transaction[];
  warnings: string[];
};

function summarizeHeaders(headers: string[]): string {
  const clean = headers.filter((h) => /^[\x20-\x7e]+$/.test(h)).slice(0, 8);
  if (clean.length === 0) return "(unreadable)";
  const suffix = headers.length > clean.length ? ", …" : "";
  return clean.join(", ") + suffix;
}

export function parseUpiCsv(text: string): UpiParseResult {
  const binaryKind = looksBinary(text);
  if (binaryKind) {
    throw new Error(
      `That file looks like a ${binaryKind} (not a CSV). Export your statement as CSV from your bank or UPI app, or use sample/upi.csv to test.`
    );
  }
  if (looksHtml(text)) {
    throw new Error(
      "That file looks like HTML (not a CSV). GPay's Takeout export is HTML — convert it to CSV first."
    );
  }

  const { headers, rows } = parseCsv(text);
  if (headers.length === 0) throw new Error("CSV appears empty.");

  const dateH = findHeader(headers, DATE_HEADERS);
  const timeH = findHeader(headers, TIME_HEADERS);
  const amountH = findHeader(headers, AMOUNT_HEADERS);
  const debitH = findHeader(headers, DEBIT_HEADERS);
  const creditH = findHeader(headers, CREDIT_HEADERS);
  const typeH = findHeader(headers, TYPE_HEADERS);
  const merchantH = findHeader(headers, MERCHANT_HEADERS);

  if (!dateH) {
    throw new Error(`Could not find a date column. Headers: ${summarizeHeaders(headers)}`);
  }
  if (!amountH && !debitH && !creditH) {
    throw new Error(`Could not find an amount/debit/credit column. Headers: ${summarizeHeaders(headers)}`);
  }

  const warnings: string[] = [];
  const transactions: Transaction[] = [];
  let unparsedDates = 0;
  let skippedCredits = 0;

  for (const row of rows) {
    const dt = parseDateTime(row[dateH], timeH ? row[timeH] : undefined);
    if (!dt) {
      unparsedDates++;
      continue;
    }

    let amount = 0;
    let isOutflow = true;

    if (debitH || creditH) {
      const debit = debitH ? parseAmount(row[debitH]) : 0;
      const credit = creditH ? parseAmount(row[creditH]) : 0;
      if (debit > 0) {
        amount = debit;
        isOutflow = true;
      } else if (credit > 0) {
        amount = credit;
        isOutflow = false;
      }
    } else if (amountH) {
      const a = parseAmount(row[amountH]);
      if (typeH && row[typeH]) {
        const t = row[typeH].toLowerCase();
        isOutflow = /debit|^dr\b|sent|paid|withdraw|out|expense/.test(t);
        amount = Math.abs(a);
      } else if (a < 0) {
        amount = Math.abs(a);
        isOutflow = true;
      } else {
        amount = a;
        isOutflow = true;
      }
    }

    if (amount === 0) continue;
    if (!isOutflow) {
      skippedCredits++;
      continue;
    }

    const merchant = (merchantH ? row[merchantH] : "").trim() || "Unknown";
    transactions.push({ datetime: dt, amount, merchant, raw: row });
  }

  if (unparsedDates > 0) {
    warnings.push(`${unparsedDates} row${unparsedDates === 1 ? "" : "s"} had unparseable dates and were skipped.`);
  }
  if (skippedCredits > 0) {
    warnings.push(`${skippedCredits} incoming credit${skippedCredits === 1 ? "" : "s"} excluded from spending.`);
  }

  return { transactions, warnings };
}

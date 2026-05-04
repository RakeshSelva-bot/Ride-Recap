import type { Transaction } from "./types";

export type PhonePeParseResult = {
  transactions: Transaction[];
  warnings: string[];
};

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function tryParseDate(line: string): Date | null {
  let m = line.match(
    /\b(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{2,4})(?:[\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i
  );
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) {
    return buildDate(parseInt(m[1], 10), MONTHS[m[2].toLowerCase()], m[3], m[4], m[5], m[6], m[7]);
  }
  m = line.match(
    /\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})(?:[\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i
  );
  if (m && MONTHS[m[1].toLowerCase()] !== undefined) {
    return buildDate(parseInt(m[2], 10), MONTHS[m[1].toLowerCase()], m[3], m[4], m[5], m[6], m[7]);
  }
  m = line.match(
    /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (m) {
    return buildDate(parseInt(m[1], 10), parseInt(m[2], 10) - 1, m[3], m[4], m[5], m[6]);
  }
  return null;
}

function buildDate(
  day: number,
  month: number,
  yearStr: string,
  hourStr?: string,
  minuteStr?: string,
  secondStr?: string,
  ampm?: string
): Date | null {
  let year = parseInt(yearStr, 10);
  if (year < 100) year += 2000;
  let hour = hourStr ? parseInt(hourStr, 10) : 0;
  const minute = minuteStr ? parseInt(minuteStr, 10) : 0;
  const second = secondStr ? parseInt(secondStr, 10) : 0;
  const ap = ampm?.toLowerCase();
  if (ap === "pm" && hour < 12) hour += 12;
  if (ap === "am" && hour === 12) hour = 0;
  const d = new Date(year, month, day, hour, minute, second);
  return isNaN(d.getTime()) ? null : d;
}

function tryParseAmount(line: string): number | null {
  let m = line.match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (m) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (!isNaN(n)) return n;
  }
  m = line.match(/(?:^|\s)([\d,]+\.\d{1,2})(?=\s|$)/);
  if (m) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (!isNaN(n)) return n;
  }
  return null;
}

const DEBIT_VERBS = /(?:Paid\s+to|Sent\s+to|Money\s+(?:sent|paid)\s+to|Bill\s+paid\s+to|Recharge\s+for|Sent\s+payment\s+to|Transferred\s+to)\s+([^\n]+?)(?=\s+(?:DEBIT|CREDIT|Transaction\s+ID|UTR|Bank\s+Ref|Banking\s+Ref|₹|Rs\.?|INR\s|$)|$)/i;
const CREDIT_VERBS = /(?:Received\s+from|Money\s+received\s+from|Credited\s+by|Refund\s+from|Received\s+payment\s+from|Credited\s+from)\s+([^\n]+?)(?=\s+(?:DEBIT|CREDIT|Transaction\s+ID|UTR|Bank\s+Ref|Banking\s+Ref|₹|Rs\.?|INR\s|$)|$)/i;
const PERIOD_LINE = /\b(?:period|statement\s+from|for\s+the\s+period|from)\b.+\b(?:to|until|through|-)\b/i;

function cleanMerchant(name: string): string {
  return name
    .replace(/\s*-?\s*(Transaction|Banking|Bank Ref|Ref(?:erence)?|UTR).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

type Pending = {
  merchant: string;
  defaultIsOutflow: boolean;
  date: Date | null;
  amount: number | null;
  explicitType: "DEBIT" | "CREDIT" | null;
};

export function parsePhonePeText(text: string): PhonePeParseResult {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const transactions: Transaction[] = [];
  const warnings: string[] = [];
  let skippedCredits = 0;

  let dateContext: Date | null = null;
  let pending: Pending | null = null;

  const flush = () => {
    if (!pending) return;
    const date = pending.date ?? dateContext;
    const amount = pending.amount;
    if (date && amount !== null) {
      const isOutflow =
        pending.explicitType === "DEBIT"
          ? true
          : pending.explicitType === "CREDIT"
          ? false
          : pending.defaultIsOutflow;
      if (isOutflow) {
        transactions.push({
          datetime: date,
          amount,
          merchant: pending.merchant,
          raw: { source: "phonepe-pdf" },
        });
      } else {
        skippedCredits++;
      }
    }
    pending = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (PERIOD_LINE.test(line)) continue;

    const dm = line.match(DEBIT_VERBS);
    const cm = line.match(CREDIT_VERBS);
    if (dm || cm) {
      flush();
      const merchant = cleanMerchant((dm ?? cm)![1]);
      const dOnLine = tryParseDate(line);
      pending = {
        merchant,
        defaultIsOutflow: !!dm,
        date: dOnLine ?? dateContext,
        amount: null,
        explicitType: null,
      };
      const aOnLine = tryParseAmount(line);
      if (aOnLine !== null) pending.amount = aOnLine;
      if (/\bDEBIT\b/i.test(line)) pending.explicitType = "DEBIT";
      else if (/\bCREDIT\b/i.test(line)) pending.explicitType = "CREDIT";
      continue;
    }

    const d = tryParseDate(line);
    if (d) {
      dateContext = d;
    }

    if (pending) {
      if (pending.amount === null) {
        const a = tryParseAmount(line);
        if (a !== null) pending.amount = a;
      }
      if (!pending.explicitType) {
        if (/\bDEBIT\b/i.test(line)) pending.explicitType = "DEBIT";
        else if (/\bCREDIT\b/i.test(line)) pending.explicitType = "CREDIT";
      }
    }
  }
  flush();

  if (skippedCredits > 0) {
    warnings.push(
      `${skippedCredits} incoming credit${skippedCredits === 1 ? "" : "s"} excluded from spending.`
    );
  }
  if (transactions.length === 0) {
    warnings.push(
      "No transactions found in this PDF. The format may need calibration — share a sample to improve the parser."
    );
  }

  return { transactions, warnings };
}

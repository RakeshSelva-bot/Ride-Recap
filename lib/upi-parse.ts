"use client";

import { parseUpiCsv, type UpiParseResult } from "./upi";
import { parsePhonePeText } from "./phonepe";
import { looksBinary } from "./detect";

export async function parseUpiFile(file: File): Promise<UpiParseResult> {
  const name = file.name.toLowerCase();
  const isPdfByName = name.endsWith(".pdf");

  if (isPdfByName) {
    const { extractPdfText } = await import("./pdf");
    const text = await extractPdfText(file);
    const result = parsePhonePeText(text);
    return { transactions: result.transactions, warnings: result.warnings };
  }

  const text = await file.text();

  if (text.startsWith("%PDF-") || looksBinary(text) === "PDF") {
    const { extractPdfText } = await import("./pdf");
    const extracted = await extractPdfText(await file.arrayBuffer());
    const result = parsePhonePeText(extracted);
    return { transactions: result.transactions, warnings: result.warnings };
  }

  return parseUpiCsv(text);
}

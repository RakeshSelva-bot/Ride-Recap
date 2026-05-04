import { readFileSync } from "node:fs";
import { parseUpiCsv } from "../lib/upi";
import { parsePhonePeText } from "../lib/phonepe";

const csv = readFileSync("samples/upi.csv", "utf8");
const csvResult = parseUpiCsv(csv);
console.log(`CSV path:    ${csvResult.transactions.length} txns, warnings: ${csvResult.warnings.length}`);

const fakePhonePe = `15 Apr 2026 10:20 AM
Paid to MTR HOTELS PVT LTD
DEBIT
Rs.520.00`;
const phonepeResult = parsePhonePeText(fakePhonePe);
console.log(`PhonePe path: ${phonepeResult.transactions.length} txns, warnings: ${phonepeResult.warnings.length}`);

if (csvResult.transactions.length === 7 && phonepeResult.transactions.length === 1) {
  console.log("OK — both paths produce expected counts.");
} else {
  console.log("FAIL");
}

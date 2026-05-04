import { readFileSync } from "node:fs";
import { parseUpiCsv } from "../lib/upi";

const csv = readFileSync("samples/upi-bank.csv", "utf8");
const r = parseUpiCsv(csv);

console.log("Transactions:", r.transactions.length);
console.log("Warnings:", r.warnings);
for (const t of r.transactions) {
  console.log(`  ${t.merchant.padEnd(25)} INR ${t.amount.toString().padStart(8)} ${t.datetime.toISOString()}`);
}

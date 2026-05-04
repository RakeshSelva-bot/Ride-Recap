import { parsePhonePeText } from "../lib/phonepe";

const layoutA = `
PhonePe Statement
For period: 01 Apr 2026 to 30 Apr 2026

15 Apr 2026 10:20 AM
Paid to MTR HOTELS PVT LTD
Transaction ID: T2604151020001
DEBIT
Rs.520.00

15 Apr 2026 11:45 AM
Paid to FORUM-LIFESTYLE
Transaction ID: T2604151145002
DEBIT
Rs.1,899.00

15 Apr 2026 13:00
Paid to FORUM-NIKE STORE
Transaction ID: T2604151300003
DEBIT
Rs.2,499.00

15 Apr 2026 02:00 PM
Paid to TRUFFLES KORAMANGALA
DEBIT
Rs.1,240.00

15 Apr 2026 06:30 PM
Paid to TOIT BREWPUB
Transaction ID: T2604151830005
DEBIT
Rs.890.00

15 Apr 2026 07:45 PM
Paid to TOIT BREWPUB
DEBIT
Rs.1,560.00

15 Apr 2026 08:45 PM
Received from AMAZON SELLER SERVICES
CREDIT
Rs.1,200.00
`;

const layoutB = `
Statement of Transactions

Apr 14, 2026, 10:15 PM    Paid to SWIGGY ORDER     DEBIT    ₹425.00
Apr 15, 2026, 10:20 AM    Paid to MTR HOTELS       DEBIT    ₹520.00
`;

console.log("=== Layout A (PhonePe-style block per txn) ===");
const a = parsePhonePeText(layoutA);
console.log(`Transactions: ${a.transactions.length}`);
console.log(`Warnings: ${a.warnings.join("; ") || "none"}`);
for (const t of a.transactions) {
  console.log(`  ${t.merchant.padEnd(30)} ${t.amount.toString().padStart(8)} ${t.datetime.toISOString()}`);
}

console.log("\n=== Layout B (one-line tabular) ===");
const b = parsePhonePeText(layoutB);
console.log(`Transactions: ${b.transactions.length}`);
for (const t of b.transactions) {
  console.log(`  ${t.merchant.padEnd(30)} ${t.amount.toString().padStart(8)} ${t.datetime.toISOString()}`);
}

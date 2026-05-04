import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTimeline } from "../lib/timeline";
import { parseUpiCsv } from "../lib/upi";
import { matchTransactionsToStops } from "../lib/match";

const root = join(__dirname, "..");
const timelineText = readFileSync(join(root, "samples", "timeline.json"), "utf8");
const upiText = readFileSync(join(root, "samples", "upi.csv"), "utf8");

const timeline = parseTimeline(timelineText);
const upi = parseUpiCsv(upiText);
const recap = matchTransactionsToStops(timeline.stops, upi.transactions, timeline.activities);

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const fmtTime = (d: Date) =>
  d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

console.log("=== Parsed timeline ===");
console.log(`Stops: ${timeline.stops.length}`);
for (const s of timeline.stops) {
  console.log(`  - ${s.name}  [${fmtTime(s.startTime)} → ${fmtTime(s.endTime)}]  (${s.lat}, ${s.lng})`);
}
console.log(`Activities: ${timeline.activities.length}`);
for (const a of timeline.activities) {
  console.log(`  - ${a.type}  ${a.distanceMeters ?? 0}m  [${fmtTime(a.startTime)} → ${fmtTime(a.endTime)}]`);
}

console.log("\n=== Parsed UPI ===");
console.log(`Transactions: ${upi.transactions.length}`);
for (const t of upi.transactions) {
  console.log(`  - ${t.merchant.padEnd(25)} ${inr(t.amount).padStart(10)}  ${fmtTime(t.datetime)}`);
}
if (upi.warnings.length) {
  console.log("Warnings:");
  for (const w of upi.warnings) console.log(`  ! ${w}`);
}

console.log("\n=== Recap ===");
console.log(
  `Totals: ${recap.totals.stopCount} stops, ${recap.totals.transactionCount} payments, ` +
    `${recap.totals.matchedCount} matched, total spent ${inr(recap.totals.totalSpent)}, ` +
    `distance ${(recap.totals.distanceMeters / 1000).toFixed(1)} km`
);

console.log("\nMatched stops:");
const visible = recap.stops.filter((m) => m.transactions.length > 0);
for (const m of visible) {
  console.log(`\n  ${m.stop.name}  —  ${inr(m.totalAmount)}`);
  console.log(`    ${fmtTime(m.stop.startTime)} → ${fmtTime(m.stop.endTime)}`);
  for (const t of m.transactions) {
    console.log(`    · ${t.merchant.padEnd(25)} ${inr(t.amount).padStart(10)}  @ ${fmtTime(t.datetime)}`);
  }
}

if (recap.unmatchedTransactions.length) {
  console.log("\nUnmatched payments:");
  for (const t of recap.unmatchedTransactions) {
    console.log(`  · ${t.merchant.padEnd(25)} ${inr(t.amount).padStart(10)}  @ ${fmtTime(t.datetime)}`);
  }
}

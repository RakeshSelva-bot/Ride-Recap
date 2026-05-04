import { readFileSync } from "node:fs";
import { parseTimeline } from "../lib/timeline";
import { parseUpiCsv } from "../lib/upi";
import { matchTransactionsToStops } from "../lib/match";
import { encodeRecap, decodeRecap } from "../lib/share";

const timeline = parseTimeline(readFileSync("samples/timeline.json", "utf8"));
const upi = parseUpiCsv(readFileSync("samples/upi.csv", "utf8"));
const original = matchTransactionsToStops(timeline.stops, upi.transactions, timeline.activities);

(async () => {
  const encoded = await encodeRecap(original);
  const decoded = await decodeRecap(encoded);

  console.log(`Encoded length: ${encoded.length} chars`);
  console.log(
    `Approx URL length: ${(typeof window !== "undefined" ? "" : "https://example.com/").length + "#r=".length + encoded.length} chars`
  );

  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === "object") {
      return Object.keys(v as object)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          if (k === "raw") return acc;
          acc[k] = sortKeys((v as Record<string, unknown>)[k]);
          return acc;
        }, {});
    }
    if (v instanceof Date) return v.toISOString();
    return v;
  };

  const a = JSON.stringify(sortKeys(original));
  const b = JSON.stringify(sortKeys(decoded));

  if (a === b) {
    console.log("Round-trip OK — decoded recap matches original.");
    console.log(`Stops:        ${decoded.stops.length}`);
    console.log(`Matched:      ${decoded.totals.matchedCount}`);
    console.log(`Unmatched:    ${decoded.unmatchedTransactions.length}`);
    console.log(`Total spent:  ₹${decoded.totals.totalSpent}`);
    console.log(`Distance:     ${decoded.totals.distanceMeters}m`);
  } else {
    console.log("FAIL — values differ.");
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        console.log("  at offset", i);
        console.log("  orig:", a.slice(Math.max(0, i - 20), i + 80));
        console.log("  back:", b.slice(Math.max(0, i - 20), i + 80));
        break;
      }
    }
  }
})();

import { readFileSync, writeFileSync } from "node:fs";
import { parseTimeline } from "../lib/timeline";
import { parseUpiCsv } from "../lib/upi";
import { matchTransactionsToStops } from "../lib/match";
import { recapToCsv } from "../lib/export";

const timeline = parseTimeline(readFileSync("samples/timeline.json", "utf8"));
const upi = parseUpiCsv(readFileSync("samples/upi.csv", "utf8"));
const recap = matchTransactionsToStops(timeline.stops, upi.transactions, timeline.activities);

const csv = "﻿" + recapToCsv(recap);
const today = new Date().toISOString().slice(0, 10);
const out = `C:\\Users\\ADMIN\\Desktop\\travel-recap-${today}.csv`;
writeFileSync(out, csv, "utf8");
console.log("Wrote:", out);
console.log("Bytes:", csv.length);

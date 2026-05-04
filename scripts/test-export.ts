import { readFileSync } from 'node:fs';
import { parseTimeline } from '../lib/timeline';
import { parseUpiCsv } from '../lib/upi';
import { matchTransactionsToStops } from '../lib/match';
import { recapToCsv } from '../lib/export';

const recap = matchTransactionsToStops(
  parseTimeline(readFileSync('samples/timeline.json', 'utf8')).stops,
  parseUpiCsv(readFileSync('samples/upi.csv', 'utf8')).transactions,
  parseTimeline(readFileSync('samples/timeline.json', 'utf8')).activities
);
console.log(recapToCsv(recap));

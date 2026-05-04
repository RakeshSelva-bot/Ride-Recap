import type { Stop, Transaction, MatchedStop, Activity, Recap } from "./types";

const MATCH_WINDOW_MS = 30 * 60 * 1000;

export function filterByDateRange<
  T extends { startTime: Date } | { datetime: Date },
>(items: T[], from: Date | null, to: Date | null): T[] {
  if (!from && !to) return items;
  return items.filter((item) => {
    const t = ("datetime" in item ? item.datetime : item.startTime).getTime();
    if (from && t < from.getTime()) return false;
    if (to && t > to.getTime()) return false;
    return true;
  });
}

export function getDataDateRange(
  stops: Stop[],
  transactions: Transaction[]
): { min: Date | null; max: Date | null } {
  const times: number[] = [];
  for (const s of stops) times.push(s.startTime.getTime());
  for (const t of transactions) times.push(t.datetime.getTime());
  if (times.length === 0) return { min: null, max: null };
  return { min: new Date(Math.min(...times)), max: new Date(Math.max(...times)) };
}

export function matchTransactionsToStops(
  stops: Stop[],
  transactions: Transaction[],
  activities: Activity[] = []
): Recap {
  const matched: MatchedStop[] = stops.map((s) => ({
    stop: s,
    transactions: [],
    totalAmount: 0,
  }));
  const unmatched: Transaction[] = [];

  for (const txn of transactions) {
    const t = txn.datetime.getTime();
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < stops.length; i++) {
      const start = stops[i].startTime.getTime();
      const end = stops[i].endTime.getTime();
      let dist: number;
      if (t >= start && t <= end) dist = 0;
      else if (t < start) dist = start - t;
      else dist = t - end;
      if (dist <= MATCH_WINDOW_MS && dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      matched[bestIdx].transactions.push(txn);
      matched[bestIdx].totalAmount += txn.amount;
    } else {
      unmatched.push(txn);
    }
  }

  const matchedCount = transactions.length - unmatched.length;
  const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
  const matchedSpent = matched.reduce((sum, m) => sum + m.totalAmount, 0);
  const distanceMeters = activities.reduce((sum, a) => sum + (a.distanceMeters ?? 0), 0);

  return {
    stops: matched,
    unmatchedTransactions: unmatched,
    totals: {
      stopCount: stops.length,
      transactionCount: transactions.length,
      matchedCount,
      totalSpent,
      matchedSpent,
      distanceMeters,
    },
  };
}

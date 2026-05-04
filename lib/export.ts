import type { Recap } from "./types";

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fmtLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function recapToCsv(recap: Recap): string {
  const headers = [
    "Stop",
    "Stop start",
    "Stop end",
    "Lat",
    "Lng",
    "Merchant",
    "Payment time",
    "Amount (INR)",
  ];
  const lines: string[] = [headers.join(",")];

  const matched = [...recap.stops]
    .filter((m) => m.transactions.length > 0)
    .sort((a, b) => a.stop.startTime.getTime() - b.stop.startTime.getTime());

  for (const m of matched) {
    const sortedTxns = [...m.transactions].sort(
      (a, b) => a.datetime.getTime() - b.datetime.getTime()
    );
    for (const t of sortedTxns) {
      lines.push(
        [
          csvEscape(m.stop.name),
          csvEscape(fmtLocal(m.stop.startTime)),
          csvEscape(fmtLocal(m.stop.endTime)),
          m.stop.lat.toFixed(6),
          m.stop.lng.toFixed(6),
          csvEscape(t.merchant),
          csvEscape(fmtLocal(t.datetime)),
          t.amount.toFixed(2),
        ].join(",")
      );
    }
  }

  const unmatched = [...recap.unmatchedTransactions].sort(
    (a, b) => a.datetime.getTime() - b.datetime.getTime()
  );
  for (const t of unmatched) {
    lines.push(
      ["", "", "", "", "", csvEscape(t.merchant), csvEscape(fmtLocal(t.datetime)), t.amount.toFixed(2)].join(
        ","
      )
    );
  }

  return lines.join("\n");
}

export function downloadRecapCsv(recap: Recap, filename?: string): void {
  const csv = recapToCsv(recap);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `travel-recap-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { Recap, PathSegment, MatchedStop } from "@/lib/types";
import { downloadRecapCsv } from "@/lib/export";
import { buildShareUrl } from "@/lib/share";
import { saveRecapToSupabase, buildShortShareUrl } from "@/lib/share-supabase";

const RecapMap = dynamic(() => import("./RecapMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] animate-pulse rounded-xl border border-[#2A2A3D] bg-[#13131C]" />
  ),
});

const ACCENTS = ["#60A5FA", "#F472B6", "#A3E635", "#A78BFA", "#22D3EE", "#FBBF24"] as const;

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function fmtDuration(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

function fmtKm(meters: number): string {
  return (meters / 1000).toFixed(1);
}

function dateRangeLabel(stops: MatchedStop[]): string {
  if (stops.length === 0) return "Your trip";
  const start = stops.reduce((min, s) => (s.stop.startTime < min ? s.stop.startTime : min), stops[0].stop.startTime);
  const end = stops.reduce((max, s) => (s.stop.endTime > max ? s.stop.endTime : max), stops[0].stop.endTime);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  const sameYear = start.getFullYear() === end.getFullYear();
  const day = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const dayWithYear = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  if (sameDay) return dayWithYear(start);
  if (sameYear) return `${day(start)} — ${dayWithYear(end)}`;
  return `${dayWithYear(start)} — ${dayWithYear(end)}`;
}

function groupByDay(stops: MatchedStop[]): { day: Date; items: MatchedStop[] }[] {
  const buckets = new Map<string, { day: Date; items: MatchedStop[] }>();
  for (const s of stops) {
    const d = s.stop.startTime;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const dayDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (!buckets.has(key)) buckets.set(key, { day: dayDate, items: [] });
    buckets.get(key)!.items.push(s);
  }
  return Array.from(buckets.values()).sort((a, b) => a.day.getTime() - b.day.getTime());
}

export default function RecapView({ recap, paths }: { recap: Recap; paths?: PathSegment[] }) {
  const { stops, unmatchedTransactions, totals } = recap;
  const hasTransactions = totals.transactionCount > 0;
  // No transactions uploaded → show all stops (route/map view). Otherwise only stops with spend.
  const visibleStops = [...stops]
    .filter((s) => !hasTransactions || s.transactions.length > 0)
    .sort((a, b) => a.stop.startTime.getTime() - b.stop.startTime.getTime());
  const groupedDays = groupByDay(visibleStops);

  const [shareLabel, setShareLabel] = useState("Share");
  const [shareError, setShareError] = useState<string | null>(null);
  const [shortLabel, setShortLabel] = useState("Save & get short link");
  const [shortBusy, setShortBusy] = useState(false);

  const handleShare = async () => {
    setShareError(null);
    try {
      const url = await buildShareUrl(recap);
      await navigator.clipboard.writeText(url);
      setShareLabel("Copied!");
      setTimeout(() => setShareLabel("Share"), 2000);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Could not create share link.");
    }
  };

  const handleShortLink = async () => {
    if (shortBusy) return;
    setShareError(null);
    setShortBusy(true);
    setShortLabel("Saving…");
    try {
      const id = await saveRecapToSupabase(recap, paths ?? []);
      const url = buildShortShareUrl(id);
      await navigator.clipboard.writeText(url);
      setShortLabel("Copied " + url.replace(/^https?:\/\//, ""));
      setTimeout(() => setShortLabel("Save & get short link"), 4000);
    } catch (e) {
      setShortLabel("Save & get short link");
      setShareError(
        e instanceof Error ? e.message : "Could not save recap."
      );
    } finally {
      setShortBusy(false);
    }
  };

  return (
    <div className="mt-10 flex flex-col gap-10">
      <article className="relative overflow-hidden rounded-2xl border border-[#2A2A3D] bg-[#0E0E18] shadow-[0_0_60px_-20px_rgba(167,139,250,0.35)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(50% 60% at 0% 0%, rgba(96,165,250,0.22) 0%, transparent 60%), radial-gradient(40% 50% at 100% 0%, rgba(244,114,182,0.20) 0%, transparent 60%), radial-gradient(60% 60% at 50% 110%, rgba(163,230,53,0.14) 0%, transparent 60%)",
          }}
        />

        <header className="relative flex flex-wrap items-start justify-between gap-3 border-b border-[#2A2A3D] px-6 py-5">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#60A5FA]">
              Trip recap
            </p>
            <h2 className="mt-1.5 bg-gradient-to-r from-white via-white to-[#E5E7EB] bg-clip-text text-2xl font-semibold tracking-tight text-transparent sm:text-3xl">
              {dateRangeLabel(stops)}
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              {totals.stopCount} {totals.stopCount === 1 ? "stop" : "stops"} ·{" "}
              {totals.transactionCount}{" "}
              {totals.transactionCount === 1 ? "payment" : "payments"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleShortLink}
              disabled={shortBusy}
              title="Saves the recap and copies a short link to clipboard"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#FF6B00]/40 bg-[#FF6B00]/10 px-3 py-1.5 text-sm font-medium text-[#FF6B00] transition-all hover:border-[#FF6B00] hover:bg-[#FF6B00]/15 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                />
              </svg>
              {shortLabel}
            </button>
            <button
              type="button"
              onClick={handleShare}
              title="Anyone with the link can see this recap (data embedded in URL)"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#2A2A3D] bg-[#13131C] px-3 py-1.5 text-sm font-medium text-gray-200 transition-colors hover:border-[#60A5FA] hover:text-[#60A5FA] focus:outline-none focus:ring-2 focus:ring-[#60A5FA]/40"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                />
              </svg>
              {shareLabel}
            </button>
            <button
              type="button"
              onClick={() => downloadRecapCsv(recap)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#2A2A3D] bg-[#13131C] px-3 py-1.5 text-sm font-medium text-gray-200 transition-colors hover:border-[#A3E635] hover:text-[#A3E635] focus:outline-none focus:ring-2 focus:ring-[#A3E635]/40"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              CSV
            </button>
          </div>
        </header>

        {shareError && (
          <p className="relative border-b border-[#F472B6]/30 bg-[#F472B6]/10 px-6 py-2 text-xs text-[#F9A8D4]">
            {shareError}
          </p>
        )}

        <div className="relative grid grid-cols-1 divide-y divide-[#2A2A3D] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <HeroStat
            eyebrow="Distance"
            value={totals.distanceMeters > 0 ? fmtKm(totals.distanceMeters) : "—"}
            unit={totals.distanceMeters > 0 ? "km" : undefined}
            color="#22D3EE"
          />
          <HeroStat
            eyebrow="Spent"
            value={hasTransactions ? fmtCurrency(totals.totalSpent) : "—"}
            color="#A3E635"
            footnote={hasTransactions ? `Matched ${totals.matchedCount} of ${totals.transactionCount}` : "Upload UPI file to track spend"}
          />
          <HeroStat
            eyebrow="Stops"
            value={totals.stopCount.toString()}
            color="#F472B6"
            footnote={
              groupedDays.length > 1 ? `Across ${groupedDays.length} days` : undefined
            }
          />
        </div>

        <div className="relative px-6 pb-6 pt-2">
          <div className="overflow-hidden rounded-xl border border-[#2A2A3D] bg-[#13131C] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]">
            <RecapMap stops={recap.stops} paths={paths} />
          </div>
        </div>
      </article>

      {visibleStops.length > 0 ? (
        <section>
          <h3 className="mb-5 text-[11px] font-medium uppercase tracking-[0.24em] text-[#60A5FA]">
            Itinerary
          </h3>
          <div className="flex flex-col gap-8">
            {groupedDays.map((bucket, bi) => {
              const dayColor = ACCENTS[bi % ACCENTS.length];
              const dayTotal = bucket.items.reduce((s, m) => s + m.totalAmount, 0);
              return (
                <div key={bi}>
                  <div className="mb-3 flex items-baseline gap-3">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: dayColor, boxShadow: `0 0 12px ${dayColor}` }}
                    />
                    <h4 className="text-sm font-semibold text-white">{fmtDay(bucket.day)}</h4>
                    <span className="text-xs text-gray-500">
                      {bucket.items.length} {bucket.items.length === 1 ? "stop" : "stops"}
                      {hasTransactions && (
                        <> · <span className="tabular-nums text-gray-300">{fmtCurrency(dayTotal)}</span></>
                      )}
                    </span>
                  </div>
                  <ol
                    className="relative space-y-4 border-l border-dashed pl-6"
                    style={{ borderColor: `${dayColor}55` }}
                  >
                    {bucket.items.map((m, i) => (
                      <li key={i} className="relative">
                        <span
                          className="absolute -left-[29px] top-2.5 flex h-3 w-3 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: dayColor,
                            boxShadow: `0 0 0 3px #08080F, 0 0 12px ${dayColor}`,
                          }}
                        />
                        <div className="rounded-xl border border-[#2A2A3D] bg-[#13131C] p-4 transition-all hover:border-[#3A3A52] hover:bg-[#171723]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-white">{m.stop.name}</p>
                              <p className="mt-0.5 text-xs text-gray-500">
                                {fmtTime(m.stop.startTime)} ·{" "}
                                {fmtDuration(m.stop.endTime.getTime() - m.stop.startTime.getTime())}
                              </p>
                            </div>
                            {hasTransactions && (
                              <span
                                className="shrink-0 text-base font-semibold tabular-nums"
                                style={{ color: dayColor }}
                              >
                                {fmtCurrency(m.totalAmount)}
                              </span>
                            )}
                          </div>
                          <ul className="mt-3 space-y-1 text-sm text-gray-300">
                            {m.transactions.map((t, j) => (
                              <li key={j} className="flex justify-between gap-2">
                                <span className="truncate">{t.merchant}</span>
                                <span className="shrink-0 tabular-nums text-gray-200">
                                  {fmtCurrency(t.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </section>
      ) : hasTransactions ? (
        <section className="rounded-xl border border-[#2A2A3D] bg-[#13131C] p-4 text-sm text-gray-400">
          No payments could be matched to a stop. Check that the timeline and transaction file cover the same date range.
        </section>
      ) : null}

      {unmatchedTransactions.length > 0 && (
        <section>
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.24em] text-gray-500">
            Unmatched payments
          </h3>
          <p className="mb-3 text-xs text-gray-500">No stop within ±30 minutes.</p>
          <ul className="flex flex-col gap-1 text-sm">
            {unmatchedTransactions.map((t, i) => (
              <li
                key={i}
                className="flex justify-between gap-2 rounded-lg border border-[#2A2A3D]/70 bg-[#0F0F18] px-3 py-2"
              >
                <span className="min-w-0 truncate">
                  <span className="text-gray-200">{t.merchant}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {fmtDay(t.datetime)} · {fmtTime(t.datetime)}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-gray-300">{fmtCurrency(t.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function HeroStat({
  eyebrow,
  value,
  unit,
  color,
  footnote,
}: {
  eyebrow: string;
  value: string;
  unit?: string;
  color: string;
  footnote?: string;
}) {
  return (
    <div className="px-6 py-7">
      <p
        className="text-[11px] font-medium uppercase tracking-[0.24em]"
        
"use client";

import { useEffect, useState } from "react";
import FileDropzone from "./FileDropzone";
import HowToGuide from "./HowToGuide";
import RecapView from "./RecapView";
import { parseTimeline } from "@/lib/timeline";
import { parseUpiFile } from "@/lib/upi-parse";
import { matchTransactionsToStops, filterByDateRange, getDataDateRange } from "@/lib/match";
import { decodeRecap, readRecapHash, clearRecapHash } from "@/lib/share";
import type { Recap, PathSegment } from "@/lib/types";

function toDateInputValue(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateInput(value: string, endOfDay: boolean): Date | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  return endOfDay ? new Date(y, mo, d, 23, 59, 59, 999) : new Date(y, mo, d, 0, 0, 0, 0);
}

export default function UploadForm() {
  const [timelineFile, setTimelineFile] = useState<File | null>(null);
  const [upiFile, setUpiFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [paths, setPaths] = useState<PathSegment[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fromShare, setFromShare] = useState(false);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [dataRange, setDataRange] = useState<{ min: string; max: string } | null>(null);

  useEffect(() => {
    const hash = readRecapHash();
    if (!hash) return;
    decodeRecap(hash)
      .then((r) => {
        setRecap(r);
        setFromShare(true);
      })
      .catch(() => setError("Could not load shared recap — the link may be malformed."));
  }, []);

  const ready = timelineFile !== null || upiFile !== null;

  const reset = () => {
    setError(null);
    setRecap(null);
    setPaths([]);
    setWarnings([]);
  };

  const handleSetTimeline = (f: File | null) => {
    setTimelineFile(f);
    reset();
    setFromShare(false);
    clearRecapHash();
  };

  const handleSetUpi = (f: File | null) => {
    setUpiFile(f);
    reset();
    setFromShare(false);
    clearRecapHash();
  };

  const handleGenerate = async () => {
    if (!ready || loading) return;
    setLoading(true);
    reset();
    try {
      const timeline = timelineFile
        ? parseTimeline(await timelineFile.text())
        : { stops: [], activities: [], paths: [] };
      const upi = upiFile
        ? await parseUpiFile(upiFile)
        : { transactions: [], warnings: [] };

      const fullRange = getDataDateRange(timeline.stops, upi.transactions);
      setDataRange({
        min: toDateInputValue(fullRange.min),
        max: toDateInputValue(fullRange.max),
      });

      const from = parseDateInput(fromDate, false);
      const to = parseDateInput(toDate, true);

      const filteredStops = filterByDateRange(timeline.stops, from, to);
      const filteredTxns = filterByDateRange(upi.transactions, from, to);
      const filteredActivities = filterByDateRange(timeline.activities, from, to);
      const filteredPaths = filterByDateRange(timeline.paths, from, to);

      const extraWarnings: string[] = [...upi.warnings];
      if (from || to) {
        const culledStops = timeline.stops.length - filteredStops.length;
        const culledTxns = upi.transactions.length - filteredTxns.length;
        if (culledStops > 0 || culledTxns > 0) {
          extraWarnings.push(
            `Date filter excluded ${culledStops} stop${culledStops === 1 ? "" : "s"} and ${culledTxns} payment${culledTxns === 1 ? "" : "s"} outside the selected range.`
          );
        }
      }

      const result = matchTransactionsToStops(filteredStops, filteredTxns, filteredActivities);
      setRecap(result);
      setPaths(filteredPaths);
      setWarnings(extraWarnings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while parsing your files.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <FileDropzone
          label="Google Maps Timeline JSON"
          hint="JSON from Google Takeout — optional"
          accept="application/json,.json"
          file={timelineFile}
          onFile={handleSetTimeline}
        />
        <FileDropzone
          label="UPI Transactions (CSV or PDF)"
          hint="CSV or PDF from PhonePe / GPay — optional"
          accept=".csv,.pdf,text/csv,application/pdf"
          file={upiFile}
          onFile={handleSetUpi}
        />
      </div>

      <HowToGuide />

      <div className="rounded-xl border border-[#2A2A3D] bg-[#0F0F18] p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-gray-200">Trip date range</span>
          <span className="text-xs text-gray-500">Optional — leave blank to include everything</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              max={toDate || undefined}
              className="rounded-md border border-[#2A2A3D] bg-[#15151F] px-3 py-1.5 text-sm text-gray-100 focus:border-[#60A5FA] focus:outline-none focus:ring-1 focus:ring-[#60A5FA]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate || undefined}
              className="rounded-md border border-[#2A2A3D] bg-[#15151F] px-3 py-1.5 text-sm text-gray-100 focus:border-[#60A5FA] focus:outline-none focus:ring-1 focus:ring-[#60A5FA]"
            />
          </label>
        </div>
        {dataRange && (dataRange.min || dataRange.max) && (
          <p className="mt-2 text-xs text-gray-500">
            Files cover {dataRange.min} → {dataRange.max}.{" "}
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
                className="font-medium text-[#60A5FA] hover:text-[#93C5FD] hover:underline"
              >
                Reset
              </button>
            )}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={!ready || loading}
        className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#60A5FA] via-[#A78BFA] to-[#F472B6] px-6 py-3.5 text-base font-semibold text-white shadow-[0_0_30px_-8px_rgba(167,139,250,0.6)] transition-all hover:shadow-[0_0_40px_-6px_rgba(244,114,182,0.7)] focus:outline-none focus:ring-2 focus:ring-[#A78BFA]/50 disabled:cursor-not-allowed disabled:from-[#1F1F2E] disabled:via-[#1F1F2E] disabled:to-[#1F1F2E] disabled:text-gray-500 disabled:shadow-none"
      >
        {loading ? "Generating…" : "Generate My Recap"}
      </button>

      {error && (
        <div className="rounded-xl border border-[#F472B6]/30 bg-[#F472B6]/10 px-4 py-3 text-sm text-[#F9A8D4]">
          {error}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-[#FBBF24]/30 bg-[#FBBF24]/10 px-4 py-3 text-sm text-[#FCD34D]">
          <ul className="list-disc pl-5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {recap && (
        <>
          {fromShare && (
            <div className="rounded-xl border border-[#60A5FA]/30 bg-[#60A5FA]/10 px-4 py-3 text-sm text-[#93C5FD]">
              Showing a shared recap. Upload your own files above to replace it.
            </div>
          )}
          <RecapView recap={recap} paths={paths} />
        </>
      )}
    </div>
  );
}

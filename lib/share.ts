import type { Recap, MatchedStop, Transaction } from "./types";

type WireTxn = { m: string; a: number; t: number };
type WireStop = {
  n: string;
  lat: number;
  lng: number;
  s: number;
  e: number;
  t: WireTxn[];
};
type WireRecap = { v: 1; s: WireStop[]; u: WireTxn[]; d?: number };

const MAX_URL_LENGTH = 16_000;

function toWireTxn(t: Transaction): WireTxn {
  return { m: t.merchant, a: t.amount, t: t.datetime.getTime() };
}

function toWire(recap: Recap): WireRecap {
  return {
    v: 1,
    s: recap.stops.map((m) => ({
      n: m.stop.name,
      lat: m.stop.lat,
      lng: m.stop.lng,
      s: m.stop.startTime.getTime(),
      e: m.stop.endTime.getTime(),
      t: m.transactions.map(toWireTxn),
    })),
    u: recap.unmatchedTransactions.map(toWireTxn),
    d: recap.totals.distanceMeters || undefined,
  };
}

function fromWire(w: WireRecap): Recap {
  const stops: MatchedStop[] = w.s.map((s) => {
    const transactions: Transaction[] = s.t.map((t) => ({
      merchant: t.m,
      amount: t.a,
      datetime: new Date(t.t),
      raw: {},
    }));
    return {
      stop: {
        name: s.n,
        lat: s.lat,
        lng: s.lng,
        startTime: new Date(s.s),
        endTime: new Date(s.e),
      },
      transactions,
      totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
    };
  });
  const unmatched: Transaction[] = w.u.map((t) => ({
    merchant: t.m,
    amount: t.a,
    datetime: new Date(t.t),
    raw: {},
  }));

  const matchedCount = stops.reduce((n, s) => n + s.transactions.length, 0);
  const matchedSpent = stops.reduce((s, m) => s + m.totalAmount, 0);
  const unmatchedSpent = unmatched.reduce((s, t) => s + t.amount, 0);

  return {
    stops,
    unmatchedTransactions: unmatched,
    totals: {
      stopCount: stops.length,
      transactionCount: matchedCount + unmatched.length,
      matchedCount,
      totalSpent: matchedSpent + unmatchedSpent,
      matchedSpent,
      distanceMeters: w.d ?? 0,
    },
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function compress(text: string): Promise<Uint8Array> {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function decompress(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

export async function encodeRecap(recap: Recap): Promise<string> {
  const json = JSON.stringify(toWire(recap));
  const compressed = await compress(json);
  return base64UrlEncode(compressed);
}

export async function decodeRecap(encoded: string): Promise<Recap> {
  const bytes = base64UrlDecode(encoded);
  const json = await decompress(bytes);
  const wire = JSON.parse(json) as WireRecap;
  if (wire.v !== 1) throw new Error("Unsupported share link version.");
  return fromWire(wire);
}

export async function buildShareUrl(recap: Recap): Promise<string> {
  const encoded = await encodeRecap(recap);
  const url = `${window.location.origin}${window.location.pathname}#r=${encoded}`;
  if (url.length > MAX_URL_LENGTH) {
    throw new Error(
      `Recap is too large to fit in a share link (${url.length} characters). Try a shorter date range.`
    );
  }
  return url;
}

export function readRecapHash(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(/^#r=(.+)$/);
  return m ? m[1] : null;
}

export function clearRecapHash(): void {
  if (typeof window === "undefined") return;
  if (window.location.hash.startsWith("#r=")) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

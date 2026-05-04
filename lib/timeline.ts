import type { Stop, Activity, PathSegment } from "./types";
import { looksBinary, looksHtml } from "./detect";

export type TimelineParseResult = {
  stops: Stop[];
  activities: Activity[];
  paths: PathSegment[];
};

type AnyObj = Record<string, unknown>;

function isObj(v: unknown): v is AnyObj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

function fromE7(v: unknown): number | undefined {
  const n = asNumber(v);
  return n === undefined ? undefined : n / 1e7;
}

function parseLatLngString(s: string): { lat: number; lng: number } | null {
  const m = s.match(/(-?\d+\.\d+)[^\d\-]+(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return null;
}

function parsePlaceLocation(loc: unknown): { lat: number; lng: number } | null {
  if (!loc) return null;
  if (typeof loc === "string") return parseLatLngString(loc);
  if (isObj(loc)) {
    const latLng = asString(loc.latLng);
    if (latLng) return parseLatLngString(latLng);
    const lat = asNumber(loc.lat ?? loc.latitude);
    const lng = asNumber(loc.lng ?? loc.lon ?? loc.longitude);
    if (lat !== undefined && lng !== undefined) return { lat, lng };
  }
  return null;
}

function prettifyType(s: string | undefined, fallback: string): string {
  if (!s) return fallback;
  return s
    .replace(/^TYPE_/i, "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseDateField(v: unknown): Date | null {
  const s = asString(v);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function parseTimeline(text: string): TimelineParseResult {
  const binaryKind = looksBinary(text);
  if (binaryKind) {
    throw new Error(
      `That file looks like a ${binaryKind} (not JSON). Use the Timeline JSON from Google Takeout.`
    );
  }
  if (looksHtml(text)) {
    throw new Error("That file looks like HTML (not JSON). Use the Timeline JSON from Google Takeout.");
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Timeline file is not valid JSON.");
  }

  if (Array.isArray(data)) return parseSegmentArray(data);

  if (isObj(data)) {
    if (Array.isArray(data.semanticSegments)) return parseSegmentArray(data.semanticSegments);
    if (Array.isArray(data.timelineObjects)) return parseTimelineObjects(data.timelineObjects);
    if (Array.isArray(data.locations)) {
      throw new Error(
        "This looks like raw location pings (Records.json), which has no stops. Use a Semantic Location History or Timeline export instead."
      );
    }
  }

  throw new Error(
    "Unrecognized timeline format. Expected an array of segments, { semanticSegments: [...] }, or { timelineObjects: [...] }."
  );
}

function extractTimelinePathPoints(arr: unknown): { lat: number; lng: number }[] {
  if (!Array.isArray(arr)) return [];
  const points: { lat: number; lng: number }[] = [];
  for (const item of arr) {
    if (!isObj(item)) continue;
    const c = parsePlaceLocation(item.point) ?? parsePlaceLocation(item.location);
    if (c) points.push(c);
  }
  return points;
}

function parseSegmentArray(items: unknown[]): TimelineParseResult {
  const stops: Stop[] = [];
  const activities: Activity[] = [];
  const paths: PathSegment[] = [];

  for (const raw of items) {
    if (!isObj(raw)) continue;
    const start = parseDateField(raw.startTime);
    const end = parseDateField(raw.endTime);
    if (!start || !end) continue;

    if (isObj(raw.visit)) {
      const top = isObj(raw.visit.topCandidate) ? raw.visit.topCandidate : {};
      const coords = parsePlaceLocation(top.placeLocation);
      const name =
        asString(top.placeName) ||
        prettifyType(asString(top.semanticType), "Stop");
      stops.push({
        name,
        lat: coords?.lat ?? 0,
        lng: coords?.lng ?? 0,
        startTime: start,
        endTime: end,
      });
    } else if (isObj(raw.activity)) {
      const top = isObj(raw.activity.topCandidate) ? raw.activity.topCandidate : {};
      activities.push({
        type: prettifyType(asString(top.type), "Movement"),
        startTime: start,
        endTime: end,
        distanceMeters: asNumber(raw.activity.distanceMeters),
      });
    }

    const pathPoints = extractTimelinePathPoints(raw.timelinePath);
    if (pathPoints.length >= 2) {
      paths.push({ startTime: start, endTime: end, points: pathPoints });
    }
  }

  return { stops, activities, paths };
}

function extractE7Path(obj: unknown, key: "waypoints" | "points"): { lat: number; lng: number }[] {
  if (!isObj(obj)) return [];
  const arr = obj[key];
  if (!Array.isArray(arr)) return [];
  const out: { lat: number; lng: number }[] = [];
  for (const it of arr) {
    if (!isObj(it)) continue;
    const lat = fromE7(it.latE7);
    const lng = fromE7(it.lngE7);
    if (lat !== undefined && lng !== undefined) out.push({ lat, lng });
  }
  return out;
}

function parseTimelineObjects(items: unknown[]): TimelineParseResult {
  const stops: Stop[] = [];
  const activities: Activity[] = [];
  const paths: PathSegment[] = [];

  for (const raw of items) {
    if (!isObj(raw)) continue;

    if (isObj(raw.placeVisit)) {
      const pv = raw.placeVisit;
      const loc = isObj(pv.location) ? pv.location : {};
      const dur = isObj(pv.duration) ? pv.duration : {};
      const start = parseDateField(dur.startTimestamp);
      const end = parseDateField(dur.endTimestamp);
      if (!start || !end) continue;
      stops.push({
        name: asString(loc.name) || asString(loc.address) || "Unknown place",
        address: asString(loc.address),
        lat: fromE7(loc.latitudeE7) ?? 0,
        lng: fromE7(loc.longitudeE7) ?? 0,
        startTime: start,
        endTime: end,
      });
    } else if (isObj(raw.activitySegment)) {
      const as = raw.activitySegment;
      const dur = isObj(as.duration) ? as.duration : {};
      const start = parseDateField(dur.startTimestamp);
      const end = parseDateField(dur.endTimestamp);
      if (!start || !end) continue;
      activities.push({
        type: prettifyType(asString(as.activityType), "Movement"),
        startTime: start,
        endTime: end,
        distanceMeters: asNumber(as.distance),
      });

      let points = extractE7Path(as.waypointPath, "waypoints");
      if (points.length < 2) points = extractE7Path(as.simplifiedRawPath, "points");
      if (points.length >= 2) paths.push({ startTime: start, endTime: end, points });
    }
  }

  return { stops, activities, paths };
}

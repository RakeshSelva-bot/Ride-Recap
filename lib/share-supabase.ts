import { nanoid } from "nanoid";
import { getSupabase } from "./supabase";
import { toWire, fromWire, type WireRecap } from "./share";
import type { Recap, PathSegment } from "./types";

const ID_LENGTH = 10;
const TABLE = "recaps";

type WirePath = { s: string; e: string; pts: [number, number][] };

function wirePaths(paths: PathSegment[]): WirePath[] {
  return paths.map((seg) => ({
    s: seg.startTime.toISOString(),
    e: seg.endTime.toISOString(),
    pts: seg.points.map((p) => [p.lat, p.lng]),
  }));
}

function unwirePaths(raw: WirePath[]): PathSegment[] {
  return raw.map((seg) => ({
    startTime: new Date(seg.s),
    endTime: new Date(seg.e),
    points: seg.pts.map(([lat, lng]) => ({ lat, lng })),
  }));
}

export async function saveRecapToSupabase(
  recap: Recap,
  paths: PathSegment[] = []
): Promise<string> {
  const supabase = getSupabase();
  const id = nanoid(ID_LENGTH);
  const { error } = await supabase
    .from(TABLE)
    .insert({ id, data: { recap: toWire(recap), paths: wirePaths(paths) } });
  if (error) throw new Error(error.message);
  return id;
}

export async function loadRecapFromSupabase(
  id: string
): Promise<{ recap: Recap; paths: PathSegment[] }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Recap not found.");

  const raw = data.data as { recap?: WireRecap; paths?: WirePath[] } | WireRecap;

  // Backward-compat: old rows stored WireRecap directly (no paths wrapper)
  if ("v" in raw) {
    return { recap: fromWire(raw as WireRecap), paths: [] };
  }

  return {
    recap: fromWire((raw as { recap: WireRecap; paths: WirePath[] }).recap),
    paths: unwirePaths((raw as { recap: WireRecap; paths: WirePath[] }).paths ?? []),
  };
}

export function buildShortShareUrl(id: string): string {
  if (typeof window === "undefined") return `/r/${id}`;
  return `${window.location.origin}/r/${id}`;
}

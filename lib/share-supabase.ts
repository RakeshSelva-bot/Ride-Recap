import { nanoid } from "nanoid";
import { getSupabase } from "./supabase";
import { toWire, fromWire, type WireRecap } from "./share";
import type { Recap } from "./types";

const ID_LENGTH = 10;
const TABLE = "recaps";

export async function saveRecapToSupabase(recap: Recap): Promise<string> {
  const supabase = getSupabase();
  const id = nanoid(ID_LENGTH);
  const { error } = await supabase
    .from(TABLE)
    .insert({ id, data: toWire(recap) });
  if (error) throw new Error(error.message);
  return id;
}

export async function loadRecapFromSupabase(id: string): Promise<Recap> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Recap not found.");
  return fromWire(data.data as WireRecap);
}

export function buildShortShareUrl(id: string): string {
  if (typeof window === "undefined") return `/r/${id}`;
  return `${window.location.origin}/r/${id}`;
}

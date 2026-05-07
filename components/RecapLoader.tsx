"use client";

import { useEffect, useState } from "react";
import RecapView from "./RecapView";
import { loadRecapFromSupabase } from "@/lib/share-supabase";
import type { Recap, PathSegment } from "@/lib/types";

export default function RecapLoader({ id }: { id: string }) {
  const [recap, setRecap] = useState<Recap | null>(null);
  const [paths, setPaths] = useState<PathSegment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRecapFromSupabase(id)
      .then(({ recap: r, paths: p }) => {
        if (!cancelled) {
          setRecap(r);
          setPaths(p);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load recap.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="rounded-xl border border-[#F472B6]/30 bg-[#F472B6]/10 px-4 py-3 text-sm text-[#F9A8D4]">
        Could not load this recap. {error}
      </div>
    );
  }

  if (!recap) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[#2A2A3D] bg-[#0F0F18] px-4 py-3 text-sm text-gray-400">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#FF6B00]" />
        Loading recap...
      </div>
    );
  }

  return <RecapView recap={recap} paths={paths} />;
}

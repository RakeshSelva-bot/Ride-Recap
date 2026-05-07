import type { Stop } from "./types";

type NominatimAddress = {
  amenity?: string;
  shop?: string;
  tourism?: string;
  leisure?: string;
  building?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
};

type NominatimResponse = {
  display_name?: string;
  address?: NominatimAddress;
};

function pickName(r: NominatimResponse): string {
  const a = r.address ?? {};
  const poi = a.amenity || a.shop || a.tourism || a.leisure;
  const locality = a.suburb || a.city_district || a.neighbourhood;
  const city = a.city || a.town || a.village || a.county;

  if (poi && city) return `${poi}, ${city}`;
  if (poi && locality) return `${poi}, ${locality}`;
  if (poi) return poi;
  if (locality && city) return `${locality}, ${city}`;
  if (city && a.state) return `${city}, ${a.state}`;
  if (city) return city;
  // Last resort: first segment of display_name
  if (r.display_name) return r.display_name.split(",")[0].trim();
  return "Stop";
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`;
    const res = await fetch(url, {
      headers: { "User-Agent": "TravelRecap/1.0 (https://travel-recap-one.vercel.app)" },
    });
    if (!res.ok) return "";
    const data: NominatimResponse = await res.json();
    return pickName(data);
  } catch {
    return "";
  }
}

function needsGeocode(name: string): boolean {
  if (!name) return true;
  const n = name.toLowerCase().trim();
  return n === "unknown" || n === "stop" || n === "unknown place" || n === "";
}

/** Batch reverse-geocode stops that have generic/missing names. */
export async function enrichStopNames(stops: Stop[]): Promise<Stop[]> {
  const indices = stops
    .map((s, i) => (needsGeocode(s.name) ? i : -1))
    .filter((i) => i >= 0);

  if (indices.length === 0) return stops;

  const enriched = [...stops];

  // Nominatim rate limit: 1 req/sec. Do 3 at a time with a 1s gap.
  const BATCH = 3;
  for (let b = 0; b < indices.length; b += BATCH) {
    const chunk = indices.slice(b, b + BATCH);
    const names = await Promise.all(
      chunk.map((i) => reverseGeocode(enriched[i].lat, enriched[i].lng))
    );
    chunk.forEach((i, j) => {
      if (names[j]) enriched[i] = { ...enriched[i], name: names[j] };
    });
    if (b + BATCH < indices.length) {
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  return enriched;
}

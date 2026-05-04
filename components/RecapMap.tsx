"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MatchedStop, PathSegment } from "@/lib/types";

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtTime(d: Date): string {
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  }, [map, bounds]);
  return null;
}

type Props = {
  stops: MatchedStop[];
  paths?: PathSegment[];
};

export default function RecapMap({ stops, paths = [] }: Props) {
  const points = stops
    .filter((m) => m.stop.lat !== 0 || m.stop.lng !== 0)
    .sort((a, b) => a.stop.startTime.getTime() - b.stop.startTime.getTime());

  if (points.length === 0 && paths.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-400">
        No mappable coordinates in your timeline.
      </div>
    );
  }

  const allLats: number[] = [];
  const allLngs: number[] = [];
  for (const p of points) {
    allLats.push(p.stop.lat);
    allLngs.push(p.stop.lng);
  }
  for (const seg of paths) {
    for (const pt of seg.points) {
      allLats.push(pt.lat);
      allLngs.push(pt.lng);
    }
  }

  const center: LatLngExpression = [
    (Math.min(...allLats) + Math.max(...allLats)) / 2,
    (Math.min(...allLngs) + Math.max(...allLngs)) / 2,
  ];
  const bounds: LatLngBoundsExpression | null =
    allLats.length > 1
      ? [
          [Math.min(...allLats), Math.min(...allLngs)],
          [Math.max(...allLats), Math.max(...allLngs)],
        ]
      : null;

  const stopOrderLine: LatLngExpression[] = points.map((p) => [p.stop.lat, p.stop.lng]);
  const hasPaths = paths.length > 0;

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: "420px", width: "100%" }}
      scrollWheelZoom={false}
    >
        <FitBounds bounds={bounds} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {hasPaths &&
          paths.map((seg, i) => (
            <Polyline
              key={`path-${i}`}
              positions={seg.points.map((p) => [p.lat, p.lng] as LatLngExpression)}
              pathOptions={{ color: "#60A5FA", weight: 4, opacity: 0.95 }}
            />
          ))}

        {stopOrderLine.length > 1 && (
          <Polyline
            positions={stopOrderLine}
            pathOptions={{
              color: hasPaths ? "#6B7280" : "#60A5FA",
              weight: hasPaths ? 1 : 3,
              opacity: hasPaths ? 0.35 : 0.75,
              dashArray: "5 8",
            }}
          />
        )}

        {points.map((m, i) => {
          const hasSpend = m.transactions.length > 0;
          const fill = hasSpend ? "#A3E635" : "#F472B6";
          return (
            <CircleMarker
              key={`stop-${i}`}
              center={[m.stop.lat, m.stop.lng]}
              radius={hasSpend ? 9 : 6}
              pathOptions={{
                color: "#08080F",
                fillColor: fill,
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-medium text-white">{m.stop.name}</p>
                  <p className="text-xs text-gray-400">{fmtTime(m.stop.startTime)}</p>
                  {hasSpend && (
                    <p className="mt-1 font-semibold text-[#A3E635]">{fmtCurrency(m.totalAmount)}</p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
    </MapContainer>
  );
}

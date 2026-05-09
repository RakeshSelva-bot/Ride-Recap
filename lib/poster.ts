import type { Recap, PathSegment } from "./types";

export type PosterStyle = "dark" | "light" | "print";

export interface PosterOptions {
  style: PosterStyle;
  panX: number;
  panY: number;
  zoom: number;
  brightness: number;
  contrast: number;
  overlayOpacity: number;
  routeColor: string;
  customTitle: string;
}

export const DEFAULT_OPTIONS: PosterOptions = {
  style: "dark",
  panX: 0,
  panY: 0,
  zoom: 1,
  brightness: 1,
  contrast: 1,
  overlayOpacity: 0.62,
  routeColor: "#60A5FA",
  customTitle: "",
};

interface Pt { x: number; y: number }
interface LatLng { lat: number; lng: number }

function simplify(pts: LatLng[], max: number): LatLng[] {
  if (pts.length <= max) return pts;
  const step = pts.length / max;
  return Array.from({ length: max }, (_, i) => pts[Math.floor(i * step)]);
}

function project(pts: LatLng[], ox: number, oy: number, w: number, h: number): Pt[] {
  if (pts.length === 0) return [];
  const lats = pts.map(p => p.lat);
  const lngs = pts.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 0.001;
  const lngSpan = maxLng - minLng || 0.001;
  const dataAspect = lngSpan / latSpan;
  const canvasAspect = w / h;
  let dw = w, dh = h, dx = ox, dy = oy;
  if (dataAspect > canvasAspect) {
    dh = w / dataAspect;
    dy = oy + (h - dh) / 2;
  } else {
    dw = h * dataAspect;
    dx = ox + (w - dw) / 2;
  }
  return pts.map(p => ({
    x: dx + ((p.lng - minLng) / lngSpan) * dw,
    y: dy + ((maxLat - p.lat) / latSpan) * dh,
  }));
}

function rectOverlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function drawPoster(
  canvas: HTMLCanvasElement,
  photo: HTMLImageElement | null,
  recap: Recap,
  paths: PathSegment[],
  options: PosterOptions,
  scale: number = 1
) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const { style, panX, panY, zoom, brightness, contrast, overlayOpacity, routeColor } = options;
  const isDark = style === "dark";
  const isPrint = style === "print";

  // Base background
  ctx.fillStyle = isPrint ? "#FFFFFF" : isDark ? "#07090F" : "#F5F4F0";
  ctx.fillRect(0, 0, W, H);

  // Photo
  if (photo) {
    const pa = photo.width / photo.height;
    const ca = W / H;
    let baseW: number, baseH: number;
    if (pa > ca) { baseH = H; baseW = H * pa; }
    else { baseW = W; baseH = W / pa; }
    baseW *= zoom;
    baseH *= zoom;
    const drawX = (W - baseW) / 2 + panX * W;
    const drawY = (H - baseH) / 2 + panY * H;
    ctx.filter = `brightness(${brightness}) contrast(${contrast})`;
    ctx.drawImage(photo, drawX, drawY, baseW, baseH);
    ctx.filter = "none";
    ctx.fillStyle = isPrint
      ? `rgba(255,255,255,${overlayOpacity})`
      : isDark
      ? `rgba(4,6,18,${overlayOpacity})`
      : `rgba(248,248,244,${overlayOpacity})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Route points
  const allPts: LatLng[] = paths.flatMap(s => s.points);
  const stopPts: LatLng[] = recap.stops.map(s => ({ lat: s.stop.lat, lng: s.stop.lng }));
  const routePts = simplify(allPts.length >= 2 ? allPts : stopPts, 300);

  const PAD = 52 * scale;
  const BOTTOM_PANEL = H * 0.64;
  const mapX = PAD;
  const mapY = PAD * 0.8;
  const mapW = W - PAD * 2;
  const mapH = BOTTOM_PANEL - mapY - PAD * 0.5;

  const projRoute = project(routePts, mapX, mapY, mapW, mapH);
  const projStops = project(stopPts, mapX, mapY, mapW, mapH);

  // Route line
  if (projRoute.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(projRoute[0].x, projRoute[0].y);
    for (let i = 1; i < projRoute.length - 1; i++) {
      const mx = (projRoute[i].x + projRoute[i + 1].x) / 2;
      const my = (projRoute[i].y + projRoute[i + 1].y) / 2;
      ctx.quadraticCurveTo(projRoute[i].x, projRoute[i].y, mx, my);
    }
    ctx.lineTo(projRoute[projRoute.length - 1].x, projRoute[projRoute.length - 1].y);
    ctx.strokeStyle = isPrint ? "#1E293B" : routeColor;
    ctx.lineWidth = 2.5 * scale;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // Stop dots + clamped labels
  const usedRects: { x: number; y: number; w: number; h: number }[] = [];
  const stops = recap.stops;
  ctx.textBaseline = "alphabetic";

  projStops.forEach((pt, i) => {
    const isFirst = i === 0;
    const isLast = i === stops.length - 1;
    const r = (isFirst || isLast ? 5.5 : 3.5) * scale;

    // Clamp dot within map bounds
    const cx = Math.max(PAD + r, Math.min(W - PAD - r, pt.x));
    const cy = Math.max(mapY + r, Math.min(BOTTOM_PANEL - r - 4 * scale, pt.y));

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = isFirst ? "#22D3EE" : isLast ? "#A3E635" : "#FF6B00";
    ctx.fill();
    ctx.strokeStyle = isPrint ? "#fff" : "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    const raw = stops[i].stop.name ?? "";
    const name = raw.split(",")[0].trim().slice(0, 15);
    if (!name || ["unknown", "stop", "unknown place"].includes(name.toLowerCase())) return;

    const fsize = (isFirst || isLast ? 9.5 : 8) * scale;
    ctx.font = `${isFirst || isLast ? 500 : 400} ${fsize}px system-ui,sans-serif`;
    const tw = ctx.measureText(name).width;
    const lpad = 4 * scale;
    const lw = tw + lpad * 2;
    const lh = fsize + lpad * 1.5;

    // Try right side
    let lx = cx + r + 5 * scale;
    let ly = cy + fsize * 0.4;

    // Flip left if would overflow right edge
    if (lx + lw > W - 4 * scale) lx = cx - r - 5 * scale - lw;
    // Clamp left edge
    if (lx < 4 * scale) lx = 4 * scale;
    // Clamp bottom — push label above dot if near panel
    if (ly + lh > BOTTOM_PANEL - 2 * scale) ly = cy - lh * 0.5;
    // Clamp top
    if (ly - fsize < mapY) ly = mapY + fsize;

    const rect = { x: lx, y: ly - fsize, w: lw, h: lh };
    const overlaps = usedRects.some(r2 => rectOverlaps(rect, r2));
    if (overlaps && !isFirst && !isLast) return;
    usedRects.push(rect);

    ctx.fillStyle = isPrint ? "rgba(255,255,255,0.93)" : "rgba(0,0,0,0.72)";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = isPrint ? "#1E293B" : "#FFFFFF";
    ctx.fillText(name, lx + lpad, ly);
  });

  // Stats panel — fully opaque so it's always readable
  if (!isPrint) {
    ctx.fillStyle = isDark ? "#040612" : "#F0F0EC";
    ctx.fillRect(0, BOTTOM_PANEL, W, H - BOTTOM_PANEL);
  } else {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, BOTTOM_PANEL, W, H - BOTTOM_PANEL);
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(PAD, BOTTOM_PANEL);
    ctx.lineTo(W - PAD, BOTTOM_PANEL);
    ctx.stroke();
  }

  const textPrimary = isPrint ? "#0F172A" : isDark ? "#FFFFFF" : "#0F172A";
  const textMuted = isPrint ? "#64748B" : isDark ? "rgba(255,255,255,0.5)" : "#64748B";

  const startCity = stops[0]?.stop.name.split(",")[0] ?? "";
  const endCity = stops[stops.length - 1]?.stop.name.split(",")[0] ?? "";
  const autoTitle =
    startCity && endCity && startCity !== endCity
      ? `${startCity} — ${endCity}`
      : "My Ride";
  const title = options.customTitle.trim() || autoTitle;

  ctx.font = `600 ${16 * scale}px system-ui,sans-serif`;
  ctx.fillStyle = textPrimary;
  ctx.fillText(title, PAD, BOTTOM_PANEL + 30 * scale, W - PAD * 2);

  if (stops.length > 0) {
    const d0 = stops[0].stop.startTime;
    const d1 = stops[stops.length - 1].stop.endTime;
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const dateStr =
      d0.toDateString() === d1.toDateString() ? fmt(d0) : `${fmt(d0)} — ${fmt(d1)}`;
    ctx.font = `400 ${8.5 * scale}px system-ui,sans-serif`;
    ctx.fillStyle = textMuted;
    ctx.fillText(dateStr.toUpperCase(), PAD, BOTTOM_PANEL + 46 * scale);
  }

  const kms = Math.round(recap.totals.distanceMeters / 1000);
  const ms0 = stops[0]?.stop.startTime.getTime() ?? 0;
  const ms1 = stops[stops.length - 1]?.stop.endTime.getTime() ?? 0;
  const days = ms1 > ms0 ? Math.max(1, Math.ceil((ms1 - ms0) / 86400000)) : 1;
  const statItems = [
    { val: String(kms), unit: "KM", color: "#22D3EE" },
    { val: String(recap.totals.stopCount), unit: "STOPS", color: "#F472B6" },
    { val: String(days), unit: days === 1 ? "DAY" : "DAYS", color: "#A3E635" },
  ];

  // Stats — three equal columns, numbers + label stacked, clamped to column width
  const slotW = (W - PAD * 2) / 3;
  const statY = BOTTOM_PANEL + 62 * scale;
  statItems.forEach((s, i) => {
    const sx = PAD + i * slotW;
    const maxW = slotW - 6 * scale;
    // Value
    ctx.font = `700 ${20 * scale}px system-ui,sans-serif`;
    ctx.fillStyle = isPrint ? "#0F172A" : s.color;
    ctx.fillText(s.val, sx, statY + 20 * scale, maxW);
    // Label — sits 6px below baseline of value
    ctx.font = `500 ${9 * scale}px system-ui,sans-serif`;
    ctx.fillStyle = textMuted;
    ctx.fillText(s.unit, sx, statY + 32 * scale, maxW);
  });

  ctx.font = `400 ${7 * scale}px system-ui,sans-serif`;
  ctx.fillStyle = textMuted;
  ctx.fillText("travel-recap-one.vercel.app", PAD, H - 12 * scale);
}

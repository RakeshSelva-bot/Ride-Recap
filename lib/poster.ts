import type { Recap, PathSegment } from "./types";

export type PosterStyle = "dark" | "light" | "print";

export interface PosterOptions {
  style: PosterStyle;
  // Photo
  panX: number;
  panY: number;
  zoom: number;
  brightness: number;
  contrast: number;
  overlayOpacity: number;
  // Map
  routeColor: string;
  labelColor: string;
  labelBg: boolean;
  mapZoom: number;
  mapPanX: number;
  mapPanY: number;
  // Stats panel
  panelOpacity: number;
  titleColor: string;
  titleFont: string;
  statsColor: string;
  dateColor: string;
  unitColor: string;
  // Text overrides
  customTitle: string;
  customDate: string;
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
  labelColor: "#FFFFFF",
  labelBg: false,
  mapZoom: 1,
  mapPanX: 0,
  mapPanY: 0,
  panelOpacity: 0,
  titleColor: "#FFFFFF",
  titleFont: "system-ui,sans-serif",
  statsColor: "",
  dateColor: "",
  unitColor: "",
  customTitle: "",
  customDate: "",
};

interface Pt { x: number; y: number }
interface LatLng { lat: number; lng: number }
interface Rect { x: number; y: number; w: number; h: number }

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

function rectsOverlap(a: Rect, b: Rect) {
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

  const {
    style, panX, panY, zoom, brightness, contrast, overlayOpacity,
    routeColor, labelColor, labelBg,
    mapZoom, mapPanX, mapPanY,
    panelOpacity, titleColor, titleFont, statsColor, unitColor,
  } = options;
  const isDark = style === "dark";
  const isPrint = style === "print";
  const textMuted = isPrint ? "#64748B" : isDark ? "rgba(255,255,255,0.5)" : "#64748B";

  // ── Base background ─────────────────────────────────────────
  ctx.fillStyle = isPrint ? "#FFFFFF" : isDark ? "#07090F" : "#F5F4F0";
  ctx.fillRect(0, 0, W, H);

  // ── Photo ───────────────────────────────────────────────────
  if (photo) {
    const pa = photo.width / photo.height;
    const ca = W / H;
    let baseW: number, baseH: number;
    if (pa > ca) { baseH = H; baseW = H * pa; }
    else { baseW = W; baseH = W / pa; }
    baseW *= zoom; baseH *= zoom;
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

  // ── Layout zones ─────────────────────────────────────────────
  const PAD_X = 20 * scale;
  const HEADER_H = 50 * scale;   // title + date
  const FOOTER_H = 60 * scale;   // KM / STOPS / DAYS
  const MAP_TOP = HEADER_H + 4 * scale;
  const MAP_BOT = H - FOOTER_H - 4 * scale;
  const mapX = PAD_X;
  const mapY = MAP_TOP;
  const mapW = W - PAD_X * 2;
  const mapH = MAP_BOT - MAP_TOP;

  // ── Route + stop projection ──────────────────────────────────
  const allPts: LatLng[] = paths.flatMap(s => s.points);
  const stopPts: LatLng[] = recap.stops.map(s => ({ lat: s.stop.lat, lng: s.stop.lng }));
  const routePts = simplify(allPts.length >= 2 ? allPts : stopPts, 300);

  const rawRoute = project(routePts, mapX, mapY, mapW, mapH);
  const rawStops = project(stopPts, mapX, mapY, mapW, mapH);

  // Apply map zoom (centered on map center)
  const mcx = mapX + mapW / 2;
  const mcy = mapY + mapH / 2;
  const applyMapTransform = (pts: Pt[]): Pt[] =>
    pts.map(p => ({
      x: mcx + (p.x - mcx) * mapZoom + mapPanX * mapW,
      y: mcy + (p.y - mcy) * mapZoom + mapPanY * mapH,
    }));

  const projRoute = applyMapTransform(rawRoute);
  const projStops = applyMapTransform(rawStops);

  // ── Route line ───────────────────────────────────────────────
  if (projRoute.length >= 2) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapW, mapH);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(projRoute[0].x, projRoute[0].y);
    for (let i = 1; i < projRoute.length - 1; i++) {
      const mx = (projRoute[i].x + projRoute[i + 1].x) / 2;
      const my = (projRoute[i].y + projRoute[i + 1].y) / 2;
      ctx.quadraticCurveTo(projRoute[i].x, projRoute[i].y, mx, my);
    }
    ctx.lineTo(projRoute[projRoute.length - 1].x, projRoute[projRoute.length - 1].y);
    ctx.strokeStyle = routeColor;
    ctx.lineWidth = 2.5 * scale;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
  }

  // ── Stop dots + labels ───────────────────────────────────────
  const usedRects: Rect[] = [];
  const stops = recap.stops;
  ctx.textBaseline = "alphabetic";

  projStops.forEach((pt, i) => {
    const isFirst = i === 0;
    const isLast = i === stops.length - 1;
    const r = (isFirst || isLast ? 5.5 : 3.5) * scale;

    // Clamp dot to map zone
    const cx = Math.max(mapX + r, Math.min(mapX + mapW - r, pt.x));
    const cy = Math.max(mapY + r, Math.min(MAP_BOT - r - 2 * scale, pt.y));

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = isFirst ? "#22D3EE" : isLast ? "#A3E635" : "#FF6B00";
    ctx.fill();
    ctx.strokeStyle = isPrint ? "#fff" : "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    const raw = stops[i].stop.name ?? "";
    const name = raw.split(",")[0].trim().slice(0, 15);
    if (!name || ["unknown", "stop", "unknown place"].includes(name.toLowerCase())) return;

    const fsize = (isFirst || isLast ? 9 : 7.5) * scale;
    ctx.font = `${isFirst || isLast ? 600 : 400} ${fsize}px system-ui,sans-serif`;
    const tw = ctx.measureText(name).width;
    const lpad = labelBg ? 4 * scale : 2 * scale;
    const lw = tw + lpad * 2;
    const lh = fsize + lpad * 2;

    // Try four positions: right, left, above, below
    const GAP = 5 * scale;
    const candidates: { lx: number; ly: number }[] = [
      { lx: cx + r + GAP,       ly: cy + fsize * 0.35 },  // right
      { lx: cx - r - GAP - lw,  ly: cy + fsize * 0.35 },  // left
      { lx: cx - lw / 2,        ly: cy - r - GAP },        // above (baseline above dot)
      { lx: cx - lw / 2,        ly: cy + r + GAP + fsize }, // below
    ];

    let placed = false;
    for (const { lx: rawLx, ly: rawLy } of candidates) {
      // Clamp to map area
      const lx = Math.max(mapX, Math.min(mapX + mapW - lw, rawLx));
      const ly = Math.max(mapY + fsize, Math.min(MAP_BOT - 2 * scale, rawLy));
      const rect: Rect = { x: lx, y: ly - fsize, w: lw, h: lh };
      if (usedRects.some(r2 => rectsOverlap(rect, r2))) continue;
      usedRects.push(rect);

      if (labelBg) {
        ctx.fillStyle = isPrint ? "rgba(255,255,255,0.93)" : "rgba(0,0,0,0.65)";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      } else {
        ctx.shadowColor = isPrint ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.95)";
        ctx.shadowBlur = 4 * scale;
      }
      ctx.fillStyle = labelColor;
      ctx.fillText(name, lx + lpad, ly);
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      placed = true;
      break;
    }
    // First/last: force-place even if overlap (they are most important)
    if (!placed && (isFirst || isLast)) {
      const lx = Math.max(mapX, Math.min(mapX + mapW - lw, cx + r + GAP));
      const ly = Math.max(mapY + fsize, Math.min(MAP_BOT - 2 * scale, cy + fsize * 0.35));
      const rect: Rect = { x: lx, y: ly - fsize, w: lw, h: lh };
      usedRects.push(rect);
      if (labelBg) {
        ctx.fillStyle = isPrint ? "rgba(255,255,255,0.93)" : "rgba(0,0,0,0.65)";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      } else {
        ctx.shadowColor = isPrint ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.95)";
        ctx.shadowBlur = 4 * scale;
      }
      ctx.fillStyle = labelColor;
      ctx.fillText(name, lx + lpad, ly);
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
    }
  });

  // ── Panel background (optional) ──────────────────────────────
  if (panelOpacity > 0) {
    // Header
    ctx.fillStyle = isPrint ? `rgba(255,255,255,${panelOpacity})` : isDark ? `rgba(4,6,18,${panelOpacity})` : `rgba(240,240,236,${panelOpacity})`;
    ctx.fillRect(0, 0, W, HEADER_H);
    // Footer
    ctx.fillRect(0, H - FOOTER_H, W, FOOTER_H);
  }

  // Print dividers
  if (isPrint) {
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 0.8 * scale;
    ctx.beginPath(); ctx.moveTo(PAD_X, HEADER_H); ctx.lineTo(W - PAD_X, HEADER_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD_X, H - FOOTER_H); ctx.lineTo(W - PAD_X, H - FOOTER_H); ctx.stroke();
  }

  // ── Resolve title + date ─────────────────────────────────────
  const startCity = stops[0]?.stop.name.split(",")[0] ?? "";
  const endCity = stops[stops.length - 1]?.stop.name.split(",")[0] ?? "";
  const autoTitle = startCity && endCity && startCity !== endCity ? `${startCity} — ${endCity}` : "My Ride";
  const title = options.customTitle.trim() || autoTitle;

  let dateStr = options.customDate.trim();
  if (!dateStr && stops.length > 0) {
    const d0 = stops[0].stop.startTime;
    const d1 = stops[stops.length - 1].stop.endTime;
    const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    dateStr = d0.toDateString() === d1.toDateString() ? fmt(d0) : `${fmt(d0)} — ${fmt(d1)}`;
  }

  // ── HEADER: Title + Date (top) ───────────────────────────────
  ctx.textAlign = "center";
  ctx.font = `600 ${15 * scale}px ${titleFont}`;
  ctx.fillStyle = titleColor;
  ctx.fillText(title, W / 2, 22 * scale, W - PAD_X * 2);

  if (dateStr) {
    ctx.font = `400 ${8 * scale}px ${titleFont}`;
    ctx.fillStyle = options.dateColor || textMuted;
    ctx.fillText(dateStr.toUpperCase(), W / 2, 36 * scale);
  }

  ctx.textAlign = "left";

  // ── FOOTER: KM / STOPS / DAYS (bottom) ──────────────────────
  const kms = Math.round(recap.totals.distanceMeters / 1000);
  const ms0 = stops[0]?.stop.startTime.getTime() ?? 0;
  const ms1 = stops[stops.length - 1]?.stop.endTime.getTime() ?? 0;
  const days = ms1 > ms0 ? Math.max(1, Math.ceil((ms1 - ms0) / 86400000)) : 1;
  const statItems = [
    { val: String(kms), unit: "KM", color: "#22D3EE" },
    { val: String(recap.totals.stopCount), unit: "STOPS", color: "#F472B6" },
    { val: String(days), unit: days === 1 ? "DAY" : "DAYS", color: "#A3E635" },
  ];

  const slotW = (W - PAD_X * 2) / 3;
  const footerTop = H - FOOTER_H;
  const valY = footerTop + 28 * scale;
  const unitY = footerTop + 42 * scale;
  const resolvedUnitColor = options.unitColor || textMuted;

  statItems.forEach((s, i) => {
    const sx = PAD_X + i * slotW;
    const maxW = slotW - 4 * scale;
    const valColor = statsColor || (isPrint ? "#0F172A" : s.color);
    ctx.font = `700 ${20 * scale}px ${titleFont}`;
    ctx.fillStyle = valColor;
    ctx.fillText(s.val, sx, valY, maxW);
    ctx.font = `500 ${8.5 * scale}px system-ui,sans-serif`;
    ctx.fillStyle = resolvedUnitColor;
    ctx.fillText(s.unit, sx, unitY, maxW);
  });

  // Watermark
  ctx.font = `400 ${6.5 * scale}px system-ui,sans-serif`;
  ctx.fillStyle = resolvedUnitColor;
  ctx.textAlign = "right";
  ctx.fillText("travel-recap-one.vercel.app", W - PAD_X, H - 6 * scale);
  ctx.textAlign = "left";
}

import type { Recap, PathSegment } from "./types";

export type PosterStyle = "dark" | "light" | "print";
export type PosterTemplate = "dark-card" | "on-road" | "night-ride";

export interface PosterOptions {
  style: PosterStyle;
  template: PosterTemplate;
  // Photo
  panX: number; panY: number; zoom: number;
  brightness: number; contrast: number; overlayOpacity: number;
  // Map
  routeColor: string; labelColor: string; labelBg: boolean;
  mapZoom: number; mapPanX: number; mapPanY: number;
  glowRoute: boolean;
  // Stats panel
  panelOpacity: number; titleColor: string; titleFont: string;
  statsColor: string; dateColor: string; unitColor: string;
  // Text overrides
  customTitle: string; customDate: string;
  avgSpeed: string; bikeName: string;
}

export const DEFAULT_OPTIONS: PosterOptions = {
  style: "dark",
  template: "dark-card",
  panX: 0, panY: 0, zoom: 1,
  brightness: 1, contrast: 1, overlayOpacity: 0.62,
  routeColor: "#60A5FA", labelColor: "#FFFFFF", labelBg: false,
  mapZoom: 1, mapPanX: 0, mapPanY: 0,
  glowRoute: false,
  panelOpacity: 0, titleColor: "#FFFFFF", titleFont: "system-ui,sans-serif",
  statsColor: "", dateColor: "", unitColor: "",
  customTitle: "", customDate: "",
  avgSpeed: "", bikeName: "",
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
  if (dataAspect > canvasAspect) { dh = w / dataAspect; dy = oy + (h - dh) / 2; }
  else { dw = h * dataAspect; dx = ox + (w - dw) / 2; }
  return pts.map(p => ({
    x: dx + ((p.lng - minLng) / lngSpan) * dw,
    y: dy + ((maxLat - p.lat) / latSpan) * dh,
  }));
}

function rectsOverlap(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function buildPath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
}

function strokeGlow(ctx: CanvasRenderingContext2D, color: string, scale: number) {
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 28 * scale;
  ctx.lineWidth = 5 * scale; ctx.strokeStyle = color; ctx.globalAlpha = 0.45;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 14 * scale;
  ctx.lineWidth = 3 * scale; ctx.strokeStyle = color; ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.shadowColor = "#FFFFFF"; ctx.shadowBlur = 6 * scale;
  ctx.lineWidth = 1.5 * scale; ctx.strokeStyle = "#FFFFFF"; ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.restore();
}

// Warp map points to a perspective trapezoid (route lying flat on ground)
function perspWarp(
  pts: Pt[], mapX: number, mapY: number, mapW: number, mapH: number,
  W: number, H: number
): Pt[] {
  const TOP_Y  = H * 0.36;   // far edge of ground plane
  const BOT_Y  = H * 0.97;   // near edge
  const TOP_HW = W * 0.19;   // half-width of the far (top) edge

  return pts.map(pt => {
    const nx = mapW > 0 ? (pt.x - mapX) / mapW : 0.5;
    const ny = mapH > 0 ? (pt.y - mapY) / mapH : 0.5;
    // ny=0 top of map (far), ny=1 bottom (near)
    const leftX  = (W / 2 - TOP_HW) * (1 - ny);
    const rightX = (W / 2 + TOP_HW) * (1 - ny) + W * ny;
    const screenX = leftX + nx * (rightX - leftX);
    const tY = Math.pow(Math.max(0, Math.min(1, ny)), 0.72);
    const screenY = TOP_Y + tY * (BOT_Y - TOP_Y);
    return { x: screenX, y: screenY };
  });
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
    style, template, panX, panY, zoom, brightness, contrast, overlayOpacity,
    routeColor, labelColor, labelBg,
    mapZoom, mapPanX, mapPanY, glowRoute,
    panelOpacity, titleColor, titleFont, statsColor, unitColor, dateColor,
    customTitle, customDate, avgSpeed, bikeName,
  } = options;

  const isOnRoad   = template === "on-road";
  const isNight    = template === "night-ride";
  const isDark     = style === "dark" || isNight || isOnRoad;
  const isPrint    = style === "print" && !isOnRoad && !isNight;
  const textMuted  = isPrint ? "#64748B" : isDark ? "rgba(255,255,255,0.5)" : "#64748B";
  const useGlow    = glowRoute || isOnRoad || isNight;
  const glowColor  = isOnRoad ? "#FFB800" : isNight ? "#22D3EE" : routeColor;
  const lineColor  = isOnRoad ? "#FFB800" : isNight ? "#22D3EE" : routeColor;

  // ── Background ───────────────────────────────────────────────
  ctx.fillStyle = isPrint ? "#FFFFFF" : "#07090F";
  ctx.fillRect(0, 0, W, H);

  // ── Photo ────────────────────────────────────────────────────
  if (photo) {
    const pa = photo.width / photo.height;
    const ca = W / H;
    let bW: number, bH: number;
    if (pa > ca) { bH = H; bW = H * pa; } else { bW = W; bH = W / pa; }
    bW *= zoom; bH *= zoom;
    ctx.filter = `brightness(${brightness}) contrast(${contrast})`;
    ctx.drawImage(photo, (W - bW) / 2 + panX * W, (H - bH) / 2 + panY * H, bW, bH);
    ctx.filter = "none";

    if (isOnRoad) {
      // Light scrim top + bottom only — keep the photo vivid
      ctx.fillStyle = "rgba(0,0,0,0.38)";
      ctx.fillRect(0, 0, W, H * 0.24);
      ctx.fillStyle = "rgba(0,0,0,0.58)";
      ctx.fillRect(0, H * 0.76, W, H * 0.24);
    } else {
      const oc = isPrint ? `rgba(255,255,255,${overlayOpacity})` : isDark
        ? `rgba(4,6,18,${overlayOpacity})` : `rgba(248,248,244,${overlayOpacity})`;
      ctx.fillStyle = oc;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ── Layout zones ─────────────────────────────────────────────
  const PAD_X    = 20 * scale;
  const HEADER_H = 50 * scale;
  const hasExtra = avgSpeed.trim() || bikeName.trim();
  const FOOTER_H = hasExtra ? 76 * scale : 60 * scale;
  const STRIP_H  = 70 * scale;   // on-road bottom stats strip

  const mapX = isOnRoad ? 0      : PAD_X;
  const mapY = isOnRoad ? 0      : HEADER_H + 4 * scale;
  const mapW = isOnRoad ? W      : W - PAD_X * 2;
  const mapH = isOnRoad ? H      : H - FOOTER_H - 4 * scale - mapY;

  // ── Project route + stops ────────────────────────────────────
  const allPts: LatLng[] = paths.flatMap(s => s.points);
  const stopPts: LatLng[] = recap.stops.map(s => ({ lat: s.stop.lat, lng: s.stop.lng }));
  const routePts = simplify(allPts.length >= 2 ? allPts : stopPts, 300);

  const rawRoute = project(routePts, mapX, mapY, mapW, mapH);
  const rawStops = project(stopPts,  mapX, mapY, mapW, mapH);

  const mcx = mapX + mapW / 2;
  const mcy = mapY + mapH / 2;
  const applyTx = (pts: Pt[]): Pt[] => pts.map(p => ({
    x: mcx + (p.x - mcx) * mapZoom + mapPanX * mapW,
    y: mcy + (p.y - mcy) * mapZoom + mapPanY * mapH,
  }));

  const txRoute = applyTx(rawRoute);
  const txStops = applyTx(rawStops);

  const projRoute = isOnRoad ? perspWarp(txRoute, mapX, mapY, mapW, mapH, W, H) : txRoute;
  const projStops = isOnRoad ? perspWarp(txStops, mapX, mapY, mapW, mapH, W, H) : txStops;

  // ── Route line ───────────────────────────────────────────────
  if (projRoute.length >= 2) {
    ctx.save();
    if (!isOnRoad) {
      ctx.beginPath(); ctx.rect(mapX, mapY, mapW, mapH); ctx.clip();
    }
    buildPath(ctx, projRoute);
    if (useGlow) {
      strokeGlow(ctx, glowColor, scale);
    } else {
      ctx.strokeStyle = lineColor; ctx.lineWidth = 2.5 * scale;
      ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
    }
    ctx.restore();
  }

  // ── Stop dots + labels ───────────────────────────────────────
  const usedRects: Rect[] = [];
  const stops = recap.stops;
  ctx.textBaseline = "alphabetic";

  projStops.forEach((pt, i) => {
    const isFirst = i === 0;
    const isLast  = i === stops.length - 1;
    const r = (isFirst || isLast ? 5.5 : 3.5) * scale;
    const cx = isOnRoad ? pt.x : Math.max(mapX + r, Math.min(mapX + mapW - r, pt.x));
    const cy = isOnRoad ? pt.y : Math.max(mapY + r, Math.min(mapY + mapH - r, pt.y));
    const dotColor = isFirst ? "#22D3EE" : isLast ? "#A3E635" : (isOnRoad ? glowColor : "#FF6B00");

    // Glow ring
    if (useGlow) {
      ctx.save();
      ctx.shadowColor = dotColor; ctx.shadowBlur = 12 * scale;
      ctx.beginPath(); ctx.arc(cx, cy, r + 2 * scale, 0, Math.PI * 2);
      ctx.strokeStyle = dotColor; ctx.lineWidth = 1.5 * scale; ctx.globalAlpha = 0.55;
      ctx.stroke(); ctx.restore();
    }

    // Dot fill
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    if (useGlow) {
      ctx.save(); ctx.shadowColor = dotColor; ctx.shadowBlur = 10 * scale;
      ctx.fill(); ctx.restore();
    } else { ctx.fill(); }
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5 * scale; ctx.stroke();

    // Label
    const raw  = stops[i].stop.name ?? "";
    const name = raw.split(",")[0].trim().slice(0, 15);
    if (!name || ["unknown", "stop", "unknown place"].includes(name.toLowerCase())) return;

    const fsize = (isFirst || isLast ? 9 : 7.5) * scale;
    ctx.font = `${isFirst || isLast ? 600 : 400} ${fsize}px system-ui,sans-serif`;
    const tw = ctx.measureText(name).width;
    const lpad = labelBg ? 4 * scale : 2 * scale;
    const lw = tw + lpad * 2;
    const lh = fsize + lpad * 2;
    const GAP = 5 * scale;

    const cands = [
      { lx: cx + r + GAP,      ly: cy + fsize * 0.35 },
      { lx: cx - r - GAP - lw, ly: cy + fsize * 0.35 },
      { lx: cx - lw / 2,       ly: cy - r - GAP },
      { lx: cx - lw / 2,       ly: cy + r + GAP + fsize },
    ];

    const clampX = (v: number) => isOnRoad ? v : Math.max(mapX, Math.min(mapX + mapW - lw, v));
    const clampY = (v: number) => isOnRoad ? v : Math.max(mapY + fsize, Math.min(mapY + mapH - 2 * scale, v));

    const tryPlace = (lx: number, ly: number) => {
      const fx = clampX(lx), fy = clampY(ly);
      const rect: Rect = { x: fx, y: fy - fsize, w: lw, h: lh };
      if (usedRects.some(r2 => rectsOverlap(rect, r2))) return false;
      usedRects.push(rect);
      if (labelBg) {
        ctx.fillStyle = isPrint ? "rgba(255,255,255,0.93)" : "rgba(0,0,0,0.65)";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      } else {
        ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 4 * scale;
      }
      ctx.fillStyle = isOnRoad ? glowColor : labelColor;
      ctx.fillText(name, fx + lpad, fy);
      ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
      return true;
    };

    let placed = false;
    for (const { lx, ly } of cands) { if (tryPlace(lx, ly)) { placed = true; break; } }
    if (!placed && (isFirst || isLast)) tryPlace(cx + r + GAP, cy + fsize * 0.35);
  });

  // ── Panel backgrounds (non on-road) ──────────────────────────
  if (!isOnRoad && panelOpacity > 0) {
    const bg = isPrint
      ? `rgba(255,255,255,${panelOpacity})`
      : isDark ? `rgba(4,6,18,${panelOpacity})` : `rgba(240,240,236,${panelOpacity})`;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, HEADER_H);
    ctx.fillRect(0, H - FOOTER_H, W, FOOTER_H);
  }
  if (isPrint) {
    ctx.strokeStyle = "#CBD5E1"; ctx.lineWidth = 0.8 * scale;
    ctx.beginPath(); ctx.moveTo(PAD_X, HEADER_H); ctx.lineTo(W - PAD_X, HEADER_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD_X, H - FOOTER_H); ctx.lineTo(W - PAD_X, H - FOOTER_H); ctx.stroke();
  }

  // ── Title + date ──────────────────────────────────────────────
  const startCity = stops[0]?.stop.name.split(",")[0] ?? "";
  const endCity   = stops[stops.length - 1]?.stop.name.split(",")[0] ?? "";
  const autoTitle = startCity && endCity && startCity !== endCity ? `${startCity} — ${endCity}` : "My Ride";
  const title     = customTitle.trim() || autoTitle;
  let dateStr     = customDate.trim();
  if (!dateStr && stops.length > 0) {
    const d0 = stops[0].stop.startTime;
    const d1 = stops[stops.length - 1].stop.endTime;
    const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    dateStr = d0.toDateString() === d1.toDateString() ? fmt(d0) : `${fmt(d0)} — ${fmt(d1)}`;
  }

  ctx.textAlign = "center";
  if (isOnRoad) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 14 * scale;
    ctx.font = `700 ${18 * scale}px ${titleFont}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(title.toUpperCase(), W / 2, 30 * scale, W - PAD_X * 2);
    if (dateStr) {
      ctx.font = `400 ${8 * scale}px ${titleFont}`;
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(dateStr.toUpperCase(), W / 2, 44 * scale);
    }
    ctx.restore();
  } else {
    ctx.font = `600 ${15 * scale}px ${titleFont}`;
    ctx.fillStyle = titleColor;
    ctx.fillText(title, W / 2, 22 * scale, W - PAD_X * 2);
    if (dateStr) {
      ctx.font = `400 ${8 * scale}px ${titleFont}`;
      ctx.fillStyle = dateColor || textMuted;
      ctx.fillText(dateStr.toUpperCase(), W / 2, 36 * scale);
    }
  }
  ctx.textAlign = "left";

  // ── Stats ─────────────────────────────────────────────────────
  const kms  = Math.round(recap.totals.distanceMeters / 1000);
  const ms0  = stops[0]?.stop.startTime.getTime() ?? 0;
  const ms1  = stops[stops.length - 1]?.stop.endTime.getTime() ?? 0;
  const days = ms1 > ms0 ? Math.max(1, Math.ceil((ms1 - ms0) / 86400000)) : 1;

  const baseStats: { val: string; unit: string; color: string }[] = [
    { val: String(kms),                       unit: "KM",    color: "#22D3EE" },
    { val: String(recap.totals.stopCount),    unit: "STOPS", color: "#F472B6" },
    { val: String(days),                      unit: days === 1 ? "DAY" : "DAYS", color: "#A3E635" },
  ];
  if (avgSpeed.trim()) baseStats.push({ val: avgSpeed.trim(), unit: "AVG KM/H", color: "#FB923C" });

  const resolvedUnitColor = unitColor || textMuted;

  if (isOnRoad) {
    // Solid strip at bottom
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(0, H - STRIP_H, W, STRIP_H);
    // Gold accent line
    ctx.save();
    ctx.shadowColor = glowColor; ctx.shadowBlur = 8 * scale;
    ctx.strokeStyle = glowColor; ctx.lineWidth = 1.2 * scale;
    ctx.beginPath(); ctx.moveTo(PAD_X, H - STRIP_H + 1 * scale); ctx.lineTo(W - PAD_X, H - STRIP_H + 1 * scale);
    ctx.stroke(); ctx.restore();

    const slotW = (W - PAD_X * 2) / baseStats.length;
    const valY  = H - STRIP_H + 26 * scale;
    const unitY = H - STRIP_H + 40 * scale;

    baseStats.forEach((s, i) => {
      const sx = PAD_X + i * slotW;
      ctx.save();
      ctx.shadowColor = glowColor; ctx.shadowBlur = 10 * scale;
      ctx.font = `700 ${19 * scale}px ${titleFont}`;
      ctx.fillStyle = glowColor;
      ctx.fillText(s.val, sx, valY, slotW - 4 * scale);
      ctx.restore();
      ctx.font = `500 ${7.5 * scale}px system-ui,sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText(s.unit, sx, unitY, slotW - 4 * scale);
    });

    if (bikeName.trim()) {
      ctx.font = `500 ${8 * scale}px system-ui,sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.textAlign = "center";
      ctx.fillText(`BIKE  •  ${bikeName.trim().toUpperCase()}`, W / 2, H - STRIP_H + 56 * scale);
      ctx.textAlign = "left";
    }
  } else {
    const footerTop = H - FOOTER_H;
    const valY  = footerTop + 28 * scale;
    const unitY = footerTop + 42 * scale;
    const slotW = (W - PAD_X * 2) / baseStats.length;

    baseStats.forEach((s, i) => {
      const sx     = PAD_X + i * slotW;
      const maxW   = slotW - 4 * scale;
      const vColor = statsColor || (isPrint ? "#0F172A" : s.color);
      ctx.font = `700 ${20 * scale}px ${titleFont}`;
      if (isNight) {
        ctx.save(); ctx.shadowColor = s.color; ctx.shadowBlur = 12 * scale;
        ctx.fillStyle = s.color; ctx.fillText(s.val, sx, valY, maxW); ctx.restore();
      } else {
        ctx.fillStyle = vColor; ctx.fillText(s.val, sx, valY, maxW);
      }
      ctx.font = `500 ${8.5 * scale}px system-ui,sans-serif`;
      ctx.fillStyle = resolvedUnitColor;
      ctx.fillText(s.unit, sx, unitY, maxW);
    });

    if (bikeName.trim()) {
      ctx.font = `400 ${7.5 * scale}px system-ui,sans-serif`;
      ctx.fillStyle = resolvedUnitColor;
      ctx.fillText(`BIKE  •  ${bikeName.trim().toUpperCase()}`, PAD_X, footerTop + 58 * scale, W - PAD_X * 2);
    }
  }

  // ── Watermark ─────────────────────────────────────────────────
  ctx.font = `400 ${6.5 * scale}px system-ui,sans-serif`;
  ctx.fillStyle = isOnRoad ? "rgba(255,255,255,0.28)" : resolvedUnitColor;
  ctx.textAlign = "right";
  ctx.fillText("travel-recap-one.vercel.app", W - PAD_X, H - 6 * scale);
  ctx.textAlign = "left";
}

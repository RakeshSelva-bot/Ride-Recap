import type { Recap, PathSegment } from "./types";

export type PosterStyle = "dark" | "light" | "print";

interface Pt { x: number; y: number; }
interface LatLng { lat: number; lng: number; }

function simplify(pts: LatLng[], max: number): LatLng[] {
  if (pts.length <= max) return pts;
  const step = pts.length / max;
  return Array.from({ length: max }, (_, i) => pts[Math.floor(i * step)]);
}

function project(
  pts: LatLng[],
  ox: number, oy: number,
  w: number, h: number
): Pt[] {
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
  style: PosterStyle,
  scale: number = 1
) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const isDark = style === "dark";
  const isPrint = style === "print";

  // Background
  if (photo && !isPrint) {
    const pa = photo.width / photo.height;
    const ca = W / H;
    let sw = photo.width, sh = photo.height, sx = 0, sy = 0;
    if (pa > ca) { sw = photo.height * ca; sx = (photo.width - sw) / 2; }
    else { sh = photo.width / ca; sy = (photo.height - sh) / 2; }
    ctx.drawImage(photo, sx, sy, sw, sh, 0, 0, W, H);
    ctx.fillStyle = isDark ? "rgba(4,6,18,0.62)" : "rgba(248,248,244,0.70)";
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = isPrint ? "#FFFFFF" : isDark ? "#07090F" : "#F5F4F0";
    ctx.fillRect(0, 0, W, H);
  }

  // Collect route points
  const allPts: LatLng[] = paths.flatMap(s => s.points);
  const stopPts: LatLng[] = recap.stops.map(s => ({ lat: s.stop.lat, lng: s.stop.lng }));
  const routePts = simplify(allPts.length >= 2 ? allPts : stopPts, 300);

  // Map area
  const PAD = 52 * scale;
  const mapX = PAD, mapY = PAD;
  const mapW = W - PAD * 2;
  const mapH = H * 0.54;

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
    ctx.strokeStyle = isPrint ? "#1E293B" : isDark ? "#60A5FA" : "#2563EB";
    ctx.lineWidth = 2.5 * scale;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // Stop dots + labels
  const usedRects: { x: number; y: number; w: number; h: number }[] = [];
  const stops = recap.stops;
  ctx.textBaseline = "alphabetic";

  projStops.forEach((pt, i) => {
    const isFirst = i === 0;
    const isLast = i === stops.length - 1;
    const r = (isFirst || isLast ? 5.5 : 3.5) * scale;

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fillStyle = isFirst ? "#22D3EE" : isLast ? "#A3E635" : "#FF6B00";
    ctx.fill();
    ctx.strokeStyle = isPrint ? "#fff" : "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    // Label
    const raw = stops[i].stop.name ?? "";
    const name = raw.split(",")[0].trim().slice(0, 18);
    if (!name || name.toLowerCase() === "unknown" || name.toLowerCase() === "stop") return;

    const fsize = (isFirst || isLast ? 9.5 : 8) * scale;
    ctx.font = `${isFirst || isLast ? 500 : 400} ${fsize}px system-ui,sans-serif`;
    const tw = ctx.measureText(name).width;
    const pad = 4 * scale;

    // Try right, then left
    let lx = pt.x + r + 5 * scale;
    const ly = pt.y + fsize / 2;
    const rect = { x: lx - pad, y: ly - fsize - pad / 2, w: tw + pad * 2, h: fsize + pad };
    const flipRect = { x: pt.x - r - 5 * scale - tw - pad * 2, y: rect.y, w: rect.w, h: rect.h };

    const overlapsRight = usedRects.some(r2 => rectOverlaps(rect, r2));
    const useLeft = overlapsRight && !usedRects.some(r2 => rectOverlaps(flipRect, r2));
    if (overlapsRight && !useLeft && !isFirst && !isLast) return;

    const chosen = useLeft ? flipRect : rect;
    lx = useLeft ? pt.x - r - 5 * scale - tw : lx;

    usedRects.push(chosen);
    ctx.fillStyle = isPrint ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.68)";
    ctx.fillRect(chosen.x, chosen.y, chosen.w, chosen.h);

    ctx.fillStyle = isPrint ? "#1E293B" : "#FFFFFF";
    ctx.fillText(name, lx, ly);
  });

  // Stats panel
  const panelY = H * 0.64;

  if (!isPrint) {
    ctx.fillStyle = isDark ? "rgba(4,6,18,0.88)" : "rgba(240,240,236,0.92)";
    ctx.fillRect(0, panelY, W, H - panelY);
  } else {
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, panelY);
    ctx.lineTo(W - PAD, panelY);
    ctx.stroke();
  }

  const textPrimary = isPrint ? "#0F172A" : isDark ? "#FFFFFF" : "#0F172A";
  const textMuted = isPrint ? "#64748B" : isDark ? "rgba(255,255,255,0.45)" : "#64748B";

  // Title
  const startCity = stops[0]?.stop.name.split(",")[0] ?? "";
  const endCity = stops[stops.length - 1]?.stop.name.split(",")[0] ?? "";
  const title =
    startCity && endCity && startCity !== endCity
      ? `${startCity} → ${endCity}`
      : "My Ride";

  ctx.font = `500 ${18 * scale}px system-ui,sans-serif`;
  ctx.fillStyle = textPrimary;
  ctx.fillText(title, PAD, panelY + 34 * scale, W - PAD * 2);

  // Date
  if (stops.length > 0) {
    const d0 = stops[0].stop.startTime;
    const d1 = stops[stops.length - 1].stop.endTime;
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const dateStr =
      d0.toDateString() === d1.toDateString()
        ? fmt(d0)
        : `${fmt(d0)} — ${fmt(d1)}`;
    ctx.font = `400 ${9 * scale}px system-ui,sans-serif`;
    ctx.fillStyle = textMuted;
    ctx.fillText(dateStr.toUpperCase(), PAD, panelY + 50 * scale);
  }

  // Stats
  const kms = Math.round(recap.totals.distanceMeters / 1000);
  const nstops = recap.totals.stopCount;
  const ms0 = stops[0]?.stop.startTime.getTime() ?? 0;
  const ms1 = stops[stops.length - 1]?.stop.endTime.getTime() ?? 0;
  const days = ms1 > ms0 ? Math.max(1, Math.ceil((ms1 - ms0) / 86400000)) : 1;

  const statItems = [
    { val: String(kms), unit: "KM", color: "#22D3EE" },
    { val: String(nstops), unit: "STOPS", color: "#F472B6" },
    { val: String(days), unit: days === 1 ? "DAY" : "DAYS", color: "#A3E635" },
  ];

  const slotW = (W - PAD * 2) / 3;
  statItems.forEach((s, i) => {
    const sx = PAD + i * slotW;
    const sy = panelY + 68 * scale;
    ctx.font = `500 ${26 * scale}px system-ui,sans-serif`;
    ctx.fillStyle = s.color;
    ctx.fillText(s.val, sx, sy + 26 * scale);
    ctx.font = `400 ${8 * scale}px system-ui,sans-serif`;
    ctx.fillStyle = textMuted;
    ctx.fillText(s.unit, sx, sy + 26 * scale + 14 * scale);
  });

  // Footer
  ctx.font = `400 ${7.5 * scale}px system-ui,sans-serif`;
  ctx.fillStyle = textMuted;
  ctx.fillText("travel-recap-one.vercel.app", PAD, H - 14 * scale);
}

import type { Recap, PathSegment } from "./types";

export type PosterStyle = "dark" | "light" | "print";
export type PosterTemplate = "dark-card" | "on-road" | "night-ride";

export interface PosterOptions {
  style: PosterStyle; template: PosterTemplate;
  panX: number; panY: number; zoom: number;
  brightness: number; contrast: number; overlayOpacity: number;
  routeColor: string; labelColor: string; labelBg: boolean;
  mapZoom: number; mapPanX: number; mapPanY: number; glowRoute: boolean;
  panelOpacity: number; titleColor: string; titleFont: string;
  statsColor: string; dateColor: string; unitColor: string;
  customTitle: string; customDate: string;
  avgSpeed: string; bikeName: string;
}
export const DEFAULT_OPTIONS: PosterOptions = {
  style: "dark", template: "dark-card",
  panX: 0, panY: 0, zoom: 1,
  brightness: 1, contrast: 1, overlayOpacity: 0.62,
  routeColor: "#60A5FA", labelColor: "#FFFFFF", labelBg: false,
  mapZoom: 1, mapPanX: 0, mapPanY: 0, glowRoute: false,
  panelOpacity: 0, titleColor: "#FFFFFF", titleFont: "system-ui,sans-serif",
  statsColor: "", dateColor: "", unitColor: "",
  customTitle: "", customDate: "", avgSpeed: "", bikeName: "",
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
  if (!pts.length) return [];
  const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const lSp = maxLat - minLat || 0.001, gSp = maxLng - minLng || 0.001;
  let dw = w, dh = h, dx = ox, dy = oy;
  if (gSp / lSp > w / h) { dh = w * lSp / gSp; dy = oy + (h - dh) / 2; }
  else { dw = h * gSp / lSp; dx = ox + (w - dw) / 2; }
  return pts.map(p => ({
    x: dx + (p.lng - minLng) / gSp * dw,
    y: dy + (maxLat - p.lat) / lSp * dh,
  }));
}
function rectsOverlap(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function buildPath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  if (pts.length < 2) return;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i+1].x) / 2, my = (pts[i].y + pts[i+1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
}
function strokeGlow(ctx: CanvasRenderingContext2D, color: string, scale: number) {
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  for (const [blur, lw, col, alpha] of [[28,5,color,0.45],[14,3,color,0.85],[6,1.5,"#FFFFFF",0.6]] as [number,number,string,number][]) {
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = blur*scale; ctx.lineWidth = lw*scale;
    ctx.strokeStyle = col; ctx.globalAlpha = alpha; ctx.stroke(); ctx.restore();
  }
}

// Perspective — vanishing point high, wide base to fill road
const P_TOP = 0.26, P_BOT = 0.98, P_THW = 0.020, P_BHW = 0.42;

function perspWarp(pts: Pt[], mapX: number, mapY: number, mapW: number, mapH: number, W: number, H: number): Pt[] {
  const topY = H * P_TOP, botY = H * P_BOT;
  return pts.map(pt => {
    const nx = mapW > 0 ? (pt.x - mapX) / mapW : 0.5;
    const ny = mapH > 0 ? (pt.y - mapY) / mapH : 0.5;
    const t  = Math.pow(Math.max(0, Math.min(1, ny)), 0.58);
    const hw = P_THW + (P_BHW - P_THW) * t;
    return { x: W/2 + (nx - 0.5) * hw * W * 2, y: topY + t*(botY - topY) };
  });
}
function nearness(sy: number, H: number) {
  return Math.max(0, Math.min(1, (sy - H*P_TOP) / (H*(P_BOT - P_TOP))));
}

function buildNerves(pts: Pt[], scale: number, H: number) {
  const out: {from:Pt;to:Pt;n:number}[] = [];
  if (pts.length < 6) return out;
  const ev = Math.max(4, Math.floor(pts.length / 14));
  for (let i = ev; i < pts.length - ev; i += ev) {
    const cur = pts[i], nx2 = pts[Math.min(i+3,pts.length-1)], pv = pts[Math.max(i-3,0)];
    const dx = nx2.x-pv.x, dy2 = nx2.y-pv.y, dl = Math.sqrt(dx*dx+dy2*dy2)||1;
    const n = nearness(cur.y, H);
    if (n < 0.12) continue;
    const bl = (6 + Math.random()*18) * scale * n;
    for (const s of [-1,1]) {
      const ang = (0.35 + Math.random()*0.65) * s;
      const px2 = -dy2/dl, py2 = dx/dl;
      out.push({ from: cur, to: {
        x: cur.x + (px2*Math.cos(ang)-py2*Math.sin(ang))*bl,
        y: cur.y + (px2*Math.sin(ang)+py2*Math.cos(ang))*bl*0.20,
      }, n });
    }
  }
  return out;
}

// Hologram projection style: whole path drawn in layered passes — no per-segment blobs
function drawOnRoadRoute(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, scale: number, H: number) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";

  // Nerve branches underneath
  buildNerves(pts, scale, H).forEach(({from, to, n}) => {
    ctx.save();
    ctx.globalAlpha = n * 0.50;
    ctx.lineWidth = (0.4 + 1.0 * n) * scale;
    ctx.strokeStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = (3 + 5 * n) * scale;
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
    ctx.stroke(); ctx.restore();
  });

  // 4-pass draw over the full smooth path
  const passes: [number, number, string, number][] = [
    [0.14, 18, color,      22],  // wide outer halo
    [0.38,  7, color,      10],  // soft glow layer
    [0.88,  2, color,       4],  // core line
    [0.55, 0.7, "#FFFBE0",  2],  // bright centre stripe
  ];
  for (const [alpha, lw, col, blur] of passes) {
    buildPath(ctx, pts);
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lw * scale;
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = blur * scale;
    ctx.stroke();
  }

  ctx.restore();
}

export function drawPoster(
  canvas: HTMLCanvasElement, photo: HTMLImageElement | null,
  recap: Recap, paths: PathSegment[], options: PosterOptions, scale = 1
) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const {
    style, template, panX, panY, zoom, brightness, contrast, overlayOpacity,
    routeColor, labelColor, labelBg, mapZoom, mapPanX, mapPanY, glowRoute,
    panelOpacity, titleColor, titleFont, statsColor, unitColor, dateColor,
    customTitle, customDate, avgSpeed, bikeName,
  } = options;

  const isOnRoad = template === "on-road";
  const isNight  = template === "night-ride";
  const isDark   = style === "dark" || isNight || isOnRoad;
  const isPrint  = style === "print" && !isOnRoad && !isNight;
  const textMuted = isPrint ? "#64748B" : isDark ? "rgba(255,255,255,0.5)" : "#64748B";
  const useGlow   = glowRoute || isOnRoad || isNight;
  const glowColor = isOnRoad ? "#FFB800" : isNight ? "#22D3EE" : routeColor;
  const lineColor = isOnRoad ? "#FFB800" : isNight ? "#22D3EE" : routeColor;

  ctx.fillStyle = isPrint ? "#FFFFFF" : "#07090F";
  ctx.fillRect(0, 0, W, H);

  if (photo) {
    const pa = photo.width / photo.height, ca = W / H;
    let bW = W, bH = W / pa;
    if (pa > ca) { bH = H; bW = H * pa; }
    bW *= zoom; bH *= zoom;
    ctx.filter = `brightness(${brightness}) contrast(${contrast})`;
    ctx.drawImage(photo, (W-bW)/2+panX*W, (H-bH)/2+panY*H, bW, bH);
    ctx.filter = "none";
    if (isOnRoad) {
      // Very subtle top/bottom scrim only — keep photo vivid for road paint effect
      const g = ctx.createLinearGradient(0, 0, 0, H*0.28);
      g.addColorStop(0, "rgba(0,0,0,0.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H*0.28);
    } else {
      const oc = isPrint ? `rgba(255,255,255,${overlayOpacity})` : isDark
        ? `rgba(4,6,18,${overlayOpacity})` : `rgba(248,248,244,${overlayOpacity})`;
      ctx.fillStyle = oc; ctx.fillRect(0, 0, W, H);
    }
  }

  const PAD_X    = 20 * scale;
  const HEADER_H = 50 * scale;
  const hasExtra = avgSpeed.trim() || bikeName.trim();
  const FOOTER_H = hasExtra ? 76 * scale : 60 * scale;
  const STRIP_H  = isOnRoad ? 110 * scale : 70 * scale;

  const mapX = isOnRoad ? 0 : PAD_X;
  const mapY = isOnRoad ? 0 : HEADER_H + 4*scale;
  const mapW = isOnRoad ? W : W - PAD_X*2;
  const mapH = isOnRoad ? H : H - FOOTER_H - 4*scale - mapY;

  const allPts: LatLng[] = paths.flatMap(s => s.points);
  const stopPts: LatLng[] = recap.stops.map(s => ({ lat: s.stop.lat, lng: s.stop.lng }));
  const routePts = simplify(allPts.length >= 2 ? allPts : stopPts, 300);

  const rawRoute = project(routePts, mapX, mapY, mapW, mapH);
  const rawStops = project(stopPts,  mapX, mapY, mapW, mapH);
  const mcx = mapX + mapW/2, mcy = mapY + mapH/2;
  const tx = (pts: Pt[]) => pts.map(p => ({
    x: mcx + (p.x-mcx)*mapZoom + mapPanX*mapW,
    y: mcy + (p.y-mcy)*mapZoom + mapPanY*mapH,
  }));
  const txRoute = tx(rawRoute), txStops = tx(rawStops);
  const projRoute = isOnRoad ? perspWarp(txRoute, mapX, mapY, mapW, mapH, W, H) : txRoute;
  const projStops = isOnRoad ? perspWarp(txStops, mapX, mapY, mapW, mapH, W, H) : txStops;

  // Route line
  if (projRoute.length >= 2) {
    ctx.save();
    if (isOnRoad) {
      drawOnRoadRoute(ctx, projRoute, glowColor, scale, H);
    } else {
      ctx.beginPath(); ctx.rect(mapX, mapY, mapW, mapH); ctx.clip();
      buildPath(ctx, projRoute);
      if (useGlow) strokeGlow(ctx, glowColor, scale);
      else { ctx.strokeStyle = lineColor; ctx.lineWidth = 2.5*scale; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); }
    }
    ctx.restore();
  }

  // Stop dots + labels
  const usedRects: Rect[] = [];
  const stops = recap.stops;
  ctx.textBaseline = "alphabetic";

  projStops.forEach((pt, i) => {
    const isFirst = i === 0, isLast = i === stops.length-1;
    const n = isOnRoad ? nearness(pt.y, H) : 1;
    if (isOnRoad && n < 0.08) return;
    const baseR = (isFirst||isLast ? 5.5 : 3.5) * scale;
    const r = isOnRoad ? baseR*(0.2+0.8*n) : baseR;
    const cx = isOnRoad ? pt.x : Math.max(mapX+r, Math.min(mapX+mapW-r, pt.x));
    const cy = isOnRoad ? pt.y : Math.max(mapY+r, Math.min(mapY+mapH-r, pt.y));
    const dc = isFirst ? "#22D3EE" : isLast ? "#A3E635" : (isOnRoad ? glowColor : "#FF6B00");

    if (useGlow) {
      ctx.save(); ctx.shadowColor = dc; ctx.shadowBlur = 12*scale;
      ctx.beginPath(); ctx.arc(cx, cy, r+2*scale, 0, Math.PI*2);
      ctx.strokeStyle = dc; ctx.lineWidth = 1.5*scale;
      ctx.globalAlpha = isOnRoad ? 0.6*n : 0.55; ctx.stroke(); ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = isOnRoad ? 0.3+0.7*n : 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.fillStyle = dc;
    if (useGlow) { ctx.shadowColor = dc; ctx.shadowBlur = 10*scale; }
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5*scale; ctx.stroke();
    ctx.restore();

    const raw = stops[i].stop.name ?? "";
    const name = raw.split(",")[0].trim().slice(0, 14);
    if (!name || ["unknown","stop","unknown place"].includes(name.toLowerCase())) return;

    if (isOnRoad) {
      // Pill label above dot, on the route
      if (n < 0.22) return;
      const fs = (isFirst||isLast ? 8 : 6.5) * scale;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (n-0.22)/0.25) * (0.65+0.35*n);
      ctx.font = `600 ${fs}px system-ui,sans-serif`;
      const tw = ctx.measureText(name).width;
      const pw = tw + 5*scale, ph = fs + 3.5*scale;
      const px2 = cx - pw/2, py2 = cy - r - ph - 4*scale*n;
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.beginPath();
      const rad = ph/2;
      ctx.moveTo(px2+rad, py2); ctx.arcTo(px2+pw, py2, px2+pw, py2+ph, rad);
      ctx.arcTo(px2+pw, py2+ph, px2, py2+ph, rad); ctx.arcTo(px2, py2+ph, px2, py2, rad);
      ctx.arcTo(px2, py2, px2+pw, py2, rad); ctx.closePath(); ctx.fill();
      ctx.fillStyle = glowColor; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(name, cx, py2+ph/2);
      ctx.restore();
    } else {
      const fs = (isFirst||isLast ? 9 : 7.5)*scale;
      ctx.font = `${isFirst||isLast?600:400} ${fs}px system-ui,sans-serif`;
      const tw = ctx.measureText(name).width, lp = labelBg ? 4*scale : 2*scale;
      const lw = tw+lp*2, lh = fs+lp*2, G = 5*scale;
      const cands = [
        {lx:cx+r+G, ly:cy+fs*0.35}, {lx:cx-r-G-lw, ly:cy+fs*0.35},
        {lx:cx-lw/2, ly:cy-r-G}, {lx:cx-lw/2, ly:cy+r+G+fs},
      ];
      const clX = (v: number) => Math.max(mapX, Math.min(mapX+mapW-lw, v));
      const clY = (v: number) => Math.max(mapY+fs, Math.min(mapY+mapH-2*scale, v));
      const tryP = (lx: number, ly: number) => {
        const fx = clX(lx), fy = clY(ly);
        const rect: Rect = {x:fx, y:fy-fs, w:lw, h:lh};
        if (usedRects.some(r2 => rectsOverlap(rect, r2))) return false;
        usedRects.push(rect);
        if (labelBg) { ctx.fillStyle = isPrint?"rgba(255,255,255,0.93)":"rgba(0,0,0,0.65)"; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); }
        else { ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 4*scale; }
        ctx.fillStyle = labelColor; ctx.fillText(name, fx+lp, fy);
        ctx.shadowBlur = 0; ctx.shadowColor = "transparent"; return true;
      };
      let placed = false;
      for (const {lx, ly} of cands) if (tryP(lx,ly)) { placed=true; break; }
      if (!placed && (isFirst||isLast)) tryP(cx+r+G, cy+fs*0.35);
    }
  });

  if (!isOnRoad && panelOpacity > 0) {
    const bg = isPrint ? `rgba(255,255,255,${panelOpacity})` : isDark ? `rgba(4,6,18,${panelOpacity})` : `rgba(240,240,236,${panelOpacity})`;
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,HEADER_H); ctx.fillRect(0,H-FOOTER_H,W,FOOTER_H);
  }
  if (isPrint) {
    ctx.strokeStyle = "#CBD5E1"; ctx.lineWidth = 0.8*scale;
    ctx.beginPath(); ctx.moveTo(PAD_X,HEADER_H); ctx.lineTo(W-PAD_X,HEADER_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD_X,H-FOOTER_H); ctx.lineTo(W-PAD_X,H-FOOTER_H); ctx.stroke();
  }

  const startCity = stops[0]?.stop.name.split(",")[0].trim() ?? "";
  const endCity   = stops[stops.length-1]?.stop.name.split(",")[0].trim() ?? "";
  const autoTitle = startCity && endCity && startCity !== endCity ? `${startCity} — ${endCity}` : "My Ride";
  const title = customTitle.trim() || autoTitle;
  let dateStr = customDate.trim();
  if (!dateStr && stops.length > 0) {
    const d0 = stops[0].stop.startTime, d1 = stops[stops.length-1].stop.endTime;
    const fmt = (d: Date) => d.toLocaleDateString("en-IN", {day:"numeric", month:"short", year:"numeric"});
    dateStr = d0.toDateString() === d1.toDateString() ? fmt(d0) : `${fmt(d0)} — ${fmt(d1)}`;
  }

  ctx.textAlign = "center";
  if (isOnRoad) {
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 14*scale;
    ctx.font = `700 ${18*scale}px ${titleFont}`; ctx.fillStyle = "#FFFFFF";
    ctx.fillText(title.toUpperCase(), W/2, 30*scale, W-PAD_X*2);
    if (dateStr) {
      ctx.font = `400 ${8*scale}px ${titleFont}`; ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.fillText(dateStr.toUpperCase(), W/2, 44*scale);
    }
    ctx.restore();
  } else {
    ctx.font = `600 ${15*scale}px ${titleFont}`; ctx.fillStyle = titleColor;
    ctx.fillText(title, W/2, 22*scale, W-PAD_X*2);
    if (dateStr) {
      ctx.font = `400 ${8*scale}px ${titleFont}`; ctx.fillStyle = dateColor||textMuted;
      ctx.fillText(dateStr.toUpperCase(), W/2, 36*scale);
    }
  }
  ctx.textAlign = "left";

  const kms  = Math.round(recap.totals.distanceMeters / 1000);
  const ms0  = stops[0]?.stop.startTime.getTime() ?? 0;
  const ms1  = stops[stops.length-1]?.stop.endTime.getTime() ?? 0;
  const days = ms1 > ms0 ? Math.max(1, Math.ceil((ms1-ms0)/86400000)) : 1;
  const resolvedUnitColor = unitColor || textMuted;
  const statColors = ["#22D3EE","#F472B6","#A3E635","#FB923C"];
  const baseStats = [
    {val: String(kms), unit: "KM"},
    {val: String(recap.totals.stopCount), unit: "STOPS"},
    {val: String(days), unit: days===1?"DAY":"DAYS"},
    ...(avgSpeed.trim() ? [{val: avgSpeed.trim(), unit: "AVG KM/H"}] : []),
  ];

  if (isOnRoad) {
    // Reference-style stats box
    const bY = H - STRIP_H;
    ctx.fillStyle = "rgba(0,0,0,0.78)"; ctx.fillRect(0, bY, W, STRIP_H);

    // Gold top border
    ctx.save(); ctx.shadowColor = glowColor; ctx.shadowBlur = 8*scale;
    ctx.strokeStyle = glowColor; ctx.lineWidth = 1.5*scale;
    ctx.beginPath(); ctx.moveTo(0, bY+1); ctx.lineTo(W, bY+1); ctx.stroke(); ctx.restore();

    // Vertical divider between title and stats
    const divX = W * 0.38;
    ctx.strokeStyle = "rgba(255,183,0,0.30)"; ctx.lineWidth = 0.8*scale;
    ctx.beginPath(); ctx.moveTo(divX, bY+8*scale); ctx.lineTo(divX, H-8*scale); ctx.stroke();

    // Left: FROM city / TO / DEST city stacked
    ctx.save(); ctx.shadowColor = glowColor; ctx.shadowBlur = 8*scale;
    const fromTxt = startCity.toUpperCase() || "FROM";
    const toTxt   = endCity.toUpperCase()   || "TO";
    ctx.font = `700 ${14*scale}px ${titleFont}`; ctx.fillStyle = glowColor;
    ctx.fillText(fromTxt,  PAD_X, bY + 28*scale, divX - PAD_X*2);
    ctx.font = `400 ${7.5*scale}px system-ui,sans-serif`; ctx.fillStyle = "rgba(255,183,0,0.60)";
    ctx.fillText("TO", PAD_X, bY + 44*scale);
    ctx.font = `700 ${14*scale}px ${titleFont}`; ctx.fillStyle = glowColor;
    ctx.fillText(toTxt, PAD_X, bY + 60*scale, divX - PAD_X*2);
    if (bikeName.trim()) {
      ctx.font = `400 ${6.5*scale}px system-ui,sans-serif`; ctx.fillStyle = "rgba(255,183,0,0.55)";
      ctx.fillText("BIKE  " + bikeName.trim().toUpperCase(), PAD_X, bY + 76*scale, divX - PAD_X*2);
    }
    ctx.restore();

    // Right: stat columns
    const rightW = W - divX - PAD_X;
    const cols = baseStats.length;
    const colW = rightW / cols;
    baseStats.forEach((s, i) => {
      const sx = divX + 8*scale + i*colW;
      ctx.save(); ctx.shadowColor = glowColor; ctx.shadowBlur = 6*scale;
      ctx.font = `700 ${18*scale}px ${titleFont}`; ctx.fillStyle = glowColor;
      ctx.fillText(s.val, sx, bY+48*scale, colW-6*scale);
      ctx.restore();
      ctx.font = `500 ${6*scale}px system-ui,sans-serif`; ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText(s.unit, sx, bY+62*scale, colW-6*scale);
    });

  } else {
    const ft = H - FOOTER_H, valY = ft+28*scale, unitY = ft+42*scale;
    const slotW = (W-PAD_X*2)/baseStats.length;
    baseStats.forEach((s, i) => {
      const sx = PAD_X+i*slotW, maxW = slotW-4*scale;
      const vc = statsColor||(isPrint?"#0F172A":statColors[i]??"#FFF");
      ctx.font = `700 ${20*scale}px ${titleFont}`;
      if (isNight) {
        ctx.save(); ctx.shadowColor = statColors[i]??"#FFF"; ctx.shadowBlur = 12*scale;
        ctx.fillStyle = statColors[i]??"#FFF"; ctx.fillText(s.val, sx, valY, maxW); ctx.restore();
      } else { ctx.fillStyle = vc; ctx.fillText(s.val, sx, valY, maxW); }
      ctx.font = `500 ${8.5*scale}px system-ui,sans-serif`; ctx.fillStyle = resolvedUnitColor;
      ctx.fillText(s.unit, sx, unitY, maxW);
    });
    if (bikeName.trim()) {
      ctx.font = `400 ${7.5*scale}px system-ui,sans-serif`; ctx.fillStyle = resolvedUnitColor;
      ctx.fillText("BIKE  " + bikeName.trim().toUpperCase(), PAD_X, ft+58*scale, W-PAD_X*2);
    }
  }

  ctx.font = `400 ${6.5*scale}px system-ui,sans-serif`;
  ctx.fillStyle = isOnRoad ? "rgba(255,255,255,0.22)" : resolvedUnitColor;
  ctx.textAlign = "right";
  ctx.fillText("travel-recap-one.vercel.app", W-PAD_X, H-6*scale);
  ctx.textAlign = "left";
}

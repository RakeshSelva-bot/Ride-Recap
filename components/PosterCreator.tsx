"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Recap, PathSegment } from "@/lib/types";
import { drawPoster, DEFAULT_OPTIONS, type PosterStyle, type PosterOptions } from "@/lib/poster";

const STYLES: { id: PosterStyle; label: string }[] = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "print", label: "Print" },
];

const FONTS: { value: string; label: string }[] = [
  { value: "system-ui,sans-serif", label: "Sans" },
  { value: "Georgia,serif", label: "Serif" },
  { value: "'Trebuchet MS',sans-serif", label: "Round" },
];

const PREVIEW_W = 260;
const PREVIEW_H = 325;
const EXPORT_W = 1080;
const EXPORT_H = 1350;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange, display }: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void; display?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500 w-20 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-[#FF6B00] h-1 cursor-pointer" />
      <span className="text-[10px] text-gray-500 w-9 text-right shrink-0">{display ?? value.toFixed(1)}</span>
    </div>
  );
}

function ColorDot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1 cursor-pointer">
      <span className="h-5 w-5 rounded-full border border-[#3A3A52] shrink-0" style={{ background: value }} />
      <span className="text-[10px] text-gray-500">{value.toUpperCase()}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="sr-only" />
    </label>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${on ? "bg-[#FF6B00]" : "bg-[#2A2A3D]"}`}>
      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

function Divider() {
  return <div className="border-t border-[#1E1E2E]" />;
}

export default function PosterCreator({ recap, paths, onClose }: {
  recap: Recap; paths?: PathSegment[]; onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [photoName, setPhotoName] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const [options, setOptions] = useState<PosterOptions>({ ...DEFAULT_OPTIONS });
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = PREVIEW_W; c.height = PREVIEW_H;
    drawPoster(c, photo, recap, paths ?? [], options, 1);
  }, [photo, recap, paths, options]);

  useEffect(() => { redraw(); }, [redraw]);

  const set = <K extends keyof PosterOptions>(key: K, val: PosterOptions[K]) =>
    setOptions(o => ({ ...o, [key]: val }));

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!photo) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: options.panX, startPanY: options.panY };
    e.preventDefault();
  };
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    setOptions(o => ({
      ...o,
      panX: dragRef.current!.startPanX + (e.clientX - dragRef.current!.startX) / PREVIEW_W,
      panY: dragRef.current!.startPanY + (e.clientY - dragRef.current!.startY) / PREVIEW_H,
    }));
  }, []);
  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);
  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoName(file.name);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setPhoto(img); setOptions(o => ({ ...o, panX: 0, panY: 0, zoom: 1 })); };
    img.src = url;
  };

  const handleDownload = () => {
    setDownloading(true);
    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_W; canvas.height = EXPORT_H;
    drawPoster(canvas, photo, recap, paths ?? [], options, EXPORT_W / PREVIEW_W);
    canvas.toBlob(blob => {
      if (!blob) { setDownloading(false); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ride-recap-poster.png";
      a.click();
      setDownloading(false);
    }, "image/png");
  };

  return (
    <div className="mt-6 rounded-2xl border border-[#2A2A3D] bg-[#0E0E18]" style={{ overflow: "clip" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2A2A3D] px-4 py-2.5">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#FF6B00]">Ride poster</p>
          <p className="text-[11px] text-gray-500">Shareable image for Instagram, WhatsApp or print</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors text-lg leading-none px-1">&times;</button>
      </div>

      <div className="flex flex-col sm:flex-row">
        {/* Sticky canvas column */}
        <div className="sm:sticky sm:top-4 sm:self-start flex flex-col items-center gap-1.5 p-4 shrink-0">
          <canvas
            ref={canvasRef}
            width={PREVIEW_W} height={PREVIEW_H}
            onMouseDown={onMouseDown}
            className={`rounded-xl border border-[#2A2A3D] ${photo ? "cursor-grab active:cursor-grabbing" : ""}`}
            style={{ width: PREVIEW_W, height: PREVIEW_H }}
          />
          <p className="text-[10px] text-gray-600">{photo ? "Drag to reposition" : "Preview"}</p>
        </div>

        {/* Controls column */}
        <div className="flex flex-col gap-0 flex-1 min-w-0 border-t border-[#1E1E2E] sm:border-t-0 sm:border-l sm:border-[#1E1E2E]">

          {/* Style */}
          <div className="px-4 py-3 flex flex-col gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500">Style</p>
            <div className="flex gap-1.5">
              {STYLES.map(s => (
                <button key={s.id} onClick={() => set("style", s.id)}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-all ${
                    options.style === s.id
                      ? "border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]"
                      : "border-[#2A2A3D] text-gray-400 hover:border-[#3A3A52]"
                  }`}>{s.label}</button>
              ))}
            </div>
          </div>

          <Divider />

          {/* Photo */}
          <div className="px-4 py-3 flex flex-col gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500">Photo</p>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#2A2A3D] bg-[#0A0A12] px-3 py-2 hover:border-[#60A5FA] transition-colors">
              <svg className="h-4 w-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3 19.5h18" />
              </svg>
              <span className="text-xs text-gray-400 truncate">{photoName || "Upload photo"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
            {photo && (
              <>
                <Slider label="Zoom" min={1} max={4} step={0.05} value={options.zoom} display={`${options.zoom.toFixed(1)}x`} onChange={v => set("zoom", v)} />
                <Slider label="Brightness" min={0.3} max={2} step={0.05} value={options.brightness} onChange={v => set("brightness", v)} />
                <Slider label="Contrast" min={0.3} max={2} step={0.05} value={options.contrast} onChange={v => set("contrast", v)} />
                <Slider label="Overlay" min={0} max={0.95} step={0.01} value={options.overlayOpacity} display={`${Math.round(options.overlayOpacity * 100)}%`} onChange={v => set("overlayOpacity", v)} />
                <div className="flex gap-3">
                  <button onClick={() => { setPhoto(null); setPhotoName(""); }} className="text-[10px] text-gray-500 hover:text-[#F472B6] transition-colors">Remove</button>
                  <button onClick={() => setOptions(o => ({ ...o, panX: 0, panY: 0, zoom: 1, brightness: 1, contrast: 1, overlayOpacity: 0.62 }))} className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">Reset</button>
                </div>
              </>
            )}
          </div>

          <Divider />

          {/* Map */}
          <div className="px-4 py-3 flex flex-col gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500">Map</p>
            <Row label="Route color"><ColorDot value={options.routeColor} onChange={v => set("routeColor", v)} /></Row>
            <Row label="Town names"><ColorDot value={options.labelColor} onChange={v => set("labelColor", v)} /></Row>
            <Row label="Label bg"><Toggle on={options.labelBg} onToggle={() => set("labelBg", !options.labelBg)} /></Row>
          </div>

          <Divider />

          {/* Stats panel */}
          <div className="px-4 py-3 flex flex-col gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500">Stats panel</p>
            <Slider label="Background" min={0} max={1} step={0.02} value={options.panelOpacity} display={`${Math.round(options.panelOpacity * 100)}%`} onChange={v => set("panelOpacity", v)} />
            <Row label="Title color"><ColorDot value={options.titleColor} onChange={v => set("titleColor", v)} /></Row>
            <Row label="Numbers"><ColorDot value={options.statsColor || "#22D3EE"} onChange={v => set("statsColor", v)} /></Row>
            <Row label="Font">
              <div className="flex gap-1">
                {FONTS.map(f => (
                  <button key={f.value} onClick={() => set("titleFont", f.value)}
                    className={`rounded px-2 py-1 text-[10px] border transition-all ${
                      options.titleFont === f.value
                        ? "border-[#FF6B00] text-[#FF6B00]"
                        : "border-[#2A2A3D] text-gray-400"
                    }`} style={{ fontFamily: f.value }}>{f.label}</button>
                ))}
              </div>
            </Row>
          </div>

          <Divider />

          {/* Text */}
          <div className="px-4 py-3 flex flex-col gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500">Text</p>
            <input type="text" placeholder="Title — auto from route" value={options.customTitle} maxLength={40}
              onChange={e => set("customTitle", e.target.value)}
              className="w-full rounded border border-[#2A2A3D] bg-[#0A0A12] px-2.5 py-1.5 text-xs text-gray-100 placeholder:text-gray-600 focus:border-[#FF6B00] focus:outline-none" />
            <input type="text" placeholder="Date — auto from ride" value={options.customDate} maxLength={40}
              onChange={e => set("customDate", e.target.value)}
              className="w-full rounded border border-[#2A2A3D] bg-[#0A0A12] px-2.5 py-1.5 text-xs text-gray-100 placeholder:text-gray-600 focus:border-[#FF6B00] focus:outline-none" />
          </div>

          <Divider />

          {/* Download */}
          <div className="px-4 py-3">
            <button onClick={handleDownload} disabled={downloading}
              className="w-full rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#FF9500] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all">
              {downloading ? "Generating..." : "Download PNG (1080 x 1350)"}
            </button>
            <p className="mt-1.5 text-center text-[10px] text-gray-600">Instagram, WhatsApp, A4/A3 print</p>
          </div>

        </div>
      </div>
    </div>
  );
}

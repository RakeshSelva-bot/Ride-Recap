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

const PREVIEW_W = 270;
const PREVIEW_H = 338;
const EXPORT_W = 1080;
const EXPORT_H = 1350;

function Slider({
  label, min, max, step, value, onChange, display,
}: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void; display?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400">{label}</span>
        <span className="text-[10px] text-gray-500">{display ?? value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#FF6B00] h-1 cursor-pointer" />
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400">{label}</span>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <span className="h-5 w-5 rounded border border-[#3A3A52]" style={{ background: value }} />
        <span className="text-[10px] text-gray-500">{value.toUpperCase()}</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="sr-only" />
      </label>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#2A2A3D] bg-[#13131C] p-4 flex flex-col gap-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">{title}</p>
      {children}
    </div>
  );
}

export default function PosterCreator({
  recap, paths, onClose,
}: {
  recap: Recap; paths?: PathSegment[]; onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [photoName, setPhotoName] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const [options, setOptions] = useState<PosterOptions>({ ...DEFAULT_OPTIONS });

  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = PREVIEW_W;
    canvas.height = PREVIEW_H;
    drawPoster(canvas, photo, recap, paths ?? [], options, 1);
  }, [photo, recap, paths, options]);

  useEffect(() => { redraw(); }, [redraw]);

  const set = <K extends keyof PosterOptions>(key: K, val: PosterOptions[K]) =>
    setOptions((o) => ({ ...o, [key]: val }));

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!photo) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: options.panX, startPanY: options.panY };
    e.preventDefault();
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startX) / PREVIEW_W;
    const dy = (e.clientY - dragRef.current.startY) / PREVIEW_H;
    setOptions((o) => ({ ...o, panX: dragRef.current!.startPanX + dx, panY: dragRef.current!.startPanY + dy }));
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
    img.onload = () => { setPhoto(img); setOptions((o) => ({ ...o, panX: 0, panY: 0, zoom: 1 })); };
    img.src = url;
  };

  const handleDownload = () => {
    setDownloading(true);
    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_W;
    canvas.height = EXPORT_H;
    drawPoster(canvas, photo, recap, paths ?? [], options, EXPORT_W / PREVIEW_W);
    canvas.toBlob((blob) => {
      if (!blob) { setDownloading(false); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ride-recap-poster.png";
      a.click();
      setDownloading(false);
    }, "image/png");
  };

  return (
    <div className="mt-6 rounded-2xl border border-[#2A2A3D] bg-[#0E0E18] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2A2A3D] px-5 py-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#FF6B00]">Ride poster</p>
          <p className="mt-0.5 text-xs text-gray-400">Shareable image for Instagram, WhatsApp or print</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors text-lg leading-none" aria-label="Close">&times;</button>
      </div>

      <div className="flex flex-col gap-5 p-5 lg:flex-row">
        {/* Canvas preview */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <canvas
            ref={canvasRef}
            width={PREVIEW_W} height={PREVIEW_H}
            onMouseDown={onMouseDown}
            className={`rounded-xl border border-[#2A2A3D] ${photo ? "cursor-grab active:cursor-grabbing" : ""}`}
            style={{ width: PREVIEW_W, height: PREVIEW_H }}
          />
          <p className="text-[10px] text-gray-500">{photo ? "Drag to reposition photo" : "Preview (exports 4x)"}</p>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4 flex-1 min-w-0">

          {/* Style */}
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">Style</p>
            <div className="flex gap-2">
              {STYLES.map((s) => (
                <button key={s.id} onClick={() => set("style", s.id)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                    options.style === s.id
                      ? "border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]"
                      : "border-[#2A2A3D] bg-[#13131C] text-gray-400 hover:border-[#3A3A52]"
                  }`}>{s.label}</button>
              ))}
            </div>
          </div>

          {/* Photo upload */}
          <Section title="Background photo">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[#3A3A52] bg-[#0E0E18] px-4 py-3 transition-colors hover:border-[#60A5FA]">
              <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3 19.5h18M3.75 6.75h.008v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              <span className="text-xs text-gray-300 truncate">{photoName || "Upload — bike, group, landscape"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
            {photo && (
              <div className="flex flex-col gap-3 pt-1">
                <Slider label="Zoom" min={1} max={4} step={0.05} value={options.zoom} display={`${options.zoom.toFixed(2)}x`} onChange={(v) => set("zoom", v)} />
                <Slider label="Brightness" min={0.3} max={2} step={0.05} value={options.brightness} onChange={(v) => set("brightness", v)} />
                <Slider label="Contrast" min={0.3} max={2} step={0.05} value={options.contrast} onChange={(v) => set("contrast", v)} />
                <Slider label="Overlay opacity" min={0} max={0.95} step={0.01} value={options.overlayOpacity} display={`${Math.round(options.overlayOpacity * 100)}%`} onChange={(v) => set("overlayOpacity", v)} />
                <div className="flex items-center justify-between">
                  <button onClick={() => { setPhoto(null); setPhotoName(""); setOptions((o) => ({ ...o, panX: 0, panY: 0, zoom: 1, brightness: 1, contrast: 1 })); }}
                    className="text-[10px] text-gray-500 hover:text-[#F472B6] transition-colors">Remove photo</button>
                  <button onClick={() => setOptions((o) => ({ ...o, panX: 0, panY: 0, zoom: 1, brightness: 1, contrast: 1, overlayOpacity: 0.62 }))}
                    className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">Reset</button>
                </div>
              </div>
            )}
          </Section>

          {/* Map */}
          <Section title="Map">
            <ColorPicker label="Route color" value={options.routeColor} onChange={(v) => set("routeColor", v)} />
            <ColorPicker label="Town name color" value={options.labelColor} onChange={(v) => set("labelColor", v)} />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400">Label background</span>
              <button
                onClick={() => set("labelBg", !options.labelBg)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${options.labelBg ? "bg-[#FF6B00]" : "bg-[#2A2A3D]"}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${options.labelBg ? "translate-x-4" : "translate-x-1"}`} />
              </button>
            </div>
          </Section>

          {/* Stats panel */}
          <Section title="Stats panel">
            <Slider label="Panel background" min={0} max={1} step={0.02} value={options.panelOpacity} display={`${Math.round(options.panelOpacity * 100)}%`} onChange={(v) => set("panelOpacity", v)} />
            <ColorPicker label="Title color" value={options.titleColor} onChange={(v) => set("titleColor", v)} />
            <ColorPicker label="Numbers color" value={options.statsColor || "#22D3EE"} onChange={(v) => set("statsColor", v)} />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400">Font</span>
              <div className="flex gap-2">
                {FONTS.map((f) => (
                  <button key={f.value} onClick={() => set("titleFont", f.value)}
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-all ${
                      options.titleFont === f.value
                        ? "border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]"
                        : "border-[#2A2A3D] bg-[#0E0E18] text-gray-400 hover:border-[#3A3A52]"
                    }`} style={{ fontFamily: f.value }}>{f.label}</button>
                ))}
              </div>
            </div>
          </Section>

          {/* Text */}
          <Section title="Text">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400">Title</span>
              <input type="text" placeholder="Auto from route" value={options.customTitle} maxLength={40}
                onChange={(e) => set("customTitle", e.target.value)}
                className="w-full rounded-lg border border-[#2A2A3D] bg-[#0E0E18] px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-[#FF6B00] focus:outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400">Date</span>
              <input type="text" placeholder="Auto from ride dates" value={options.customDate} maxLength={40}
                onChange={(e) => set("customDate", e.target.value)}
                className="w-full rounded-lg border border-[#2A2A3D] bg-[#0E0E18] px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-[#FF6B00] focus:outline-none" />
            </div>
            {(options.customTitle || options.customDate) && (
              <button onClick={() => setOptions((o) => ({ ...o, customTitle: "", customDate: "" }))}
                className="self-start text-[10px] text-gray-500 hover:text-gray-300 transition-colors">Reset to auto</button>
            )}
          </Section>

          {/* Download */}
          <div className="flex flex-col gap-2 pt-1">
            <button onClick={handleDownload} disabled={downloading}
              className="w-full rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#FF9500] px-4 py-3 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed">
              {downloading ? "Generating..." : "Download PNG (1080 x 1350)"}
            </button>
            <p className="text-center text-[10px] text-gray-500">High-res — Instagram, WhatsApp, A4/A3 print</p>
          </div>

        </div>
      </div>
    </div>
  );
}

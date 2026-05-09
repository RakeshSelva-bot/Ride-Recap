"use client";

import { useEffect, useRef, useState } from "react";
import type { Recap, PathSegment } from "@/lib/types";
import { drawPoster, type PosterStyle } from "@/lib/poster";

const STYLES: { id: PosterStyle; label: string }[] = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "print", label: "Print" },
];

const PREVIEW_W = 270;
const PREVIEW_H = 338;
const EXPORT_W = 1080;
const EXPORT_H = 1350;

export default function PosterCreator({
  recap,
  paths,
  onClose,
}: {
  recap: Recap;
  paths?: PathSegment[];
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [style, setStyle] = useState<PosterStyle>("dark");
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [photoName, setPhotoName] = useState<string>("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = PREVIEW_W;
    canvas.height = PREVIEW_H;
    drawPoster(canvas, photo, recap, paths ?? [], style, 1);
  }, [photo, style, recap, paths]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoName(file.name);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setPhoto(img);
    img.src = url;
  };

  const handleDownload = () => {
    setDownloading(true);
    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_W;
    canvas.height = EXPORT_H;
    const s = EXPORT_W / PREVIEW_W;
    drawPoster(canvas, photo, recap, paths ?? [], style, s);
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
      <div className="flex items-center justify-between border-b border-[#2A2A3D] px-5 py-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#FF6B00]">Ride poster</p>
          <p className="mt-0.5 text-xs text-gray-400">Shareable image for Instagram, WhatsApp or print</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-200 transition-colors text-lg leading-none"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      <div className="flex flex-col gap-6 p-5 sm:flex-row">
        <div className="flex flex-col items-center gap-3">
          <canvas
            ref={canvasRef}
            width={PREVIEW_W}
            height={PREVIEW_H}
            className="rounded-xl border border-[#2A2A3D]"
            style={{ width: PREVIEW_W, height: PREVIEW_H }}
          />
          <p className="text-[10px] text-gray-500">Preview (exports at 4x this size)</p>
        </div>

        <div className="flex flex-col gap-5 flex-1">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">Background photo</p>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[#3A3A52] bg-[#13131C] px-4 py-3 transition-colors hover:border-[#60A5FA]">
              <svg className="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3 19.5h18M3.75 6.75h.008v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              <span className="text-sm text-gray-300 truncate">
                {photoName || "Upload your photo — bike, group, landscape"}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
            {photo && (
              <button
                onClick={() => { setPhoto(null); setPhotoName(""); }}
                className="mt-1.5 text-[11px] text-gray-500 hover:text-[#F472B6] transition-colors"
              >
                Remove photo
              </button>
            )}
          </div>

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">Style</p>
            <div className="flex gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                    style === s.id
                      ? "border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]"
                      : "border-[#2A2A3D] bg-[#13131C] text-gray-400 hover:border-[#3A3A52] hover:text-gray-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-gray-500">
              {style === "dark" && "Dark background — best for Instagram and WhatsApp"}
              {style === "light" && "Light background — clean and minimal"}
              {style === "print" && "White background — print at A4 or A3, frame it"}
            </p>
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#FF9500] px-4 py-3 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {downloading ? "Generating..." : "Download PNG (1080 x 1350)"}
            </button>
            <p className="text-center text-[10px] text-gray-500">
              High-res PNG — ready for Instagram, WhatsApp, or A4/A3 print
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

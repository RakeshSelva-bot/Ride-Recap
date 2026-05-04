"use client";

import { useRef, useState, DragEvent, ChangeEvent } from "react";

type Props = {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onFile: (file: File | null) => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDropzone({ label, hint, accept, file, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFile(dropped);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    onFile(picked);
  };

  const openPicker = () => inputRef.current?.click();

  const borderClass = isDragging
    ? "border-[#FF6B00] bg-[#FF6B00]/10 shadow-[0_0_0_4px_rgba(255,107,0,0.2)]"
    : file
    ? "border-[#A3E635]/60 bg-[#0F1318]"
    : "border-[#2A2A3D] bg-[#0F0F18] hover:border-[rgba(255,107,0,0.4)] hover:shadow-[0_0_12px_rgba(255,107,0,0.15)]";

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-200">{label}</span>
      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openPicker()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#60A5FA]/40 ${borderClass}`}
      >
        {file ? (
          <>
            <svg
              className="h-8 w-8 text-[#A3E635]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <p className="text-sm font-medium text-white break-all">{file.name}</p>
            <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="mt-2 text-xs font-medium text-[#60A5FA] hover:text-[#93C5FD] hover:underline"
            >
              Replace file
            </button>
          </>
        ) : (
          <>
            <svg
              className="h-8 w-8 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            <p className="text-sm text-gray-300">
              <span className="font-medium text-[#60A5FA]">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">{hint}</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
      </div>
    </div>
  );
}

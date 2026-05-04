"use client";

import * as pdfjsLib from "pdfjs-dist";

let workerConfigured = false;
function ensureWorker() {
  if (workerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  workerConfigured = true;
}

export type ExtractOptions = {
  password?: string;
};

export async function extractPdfText(
  file: File | ArrayBuffer,
  opts: ExtractOptions = {}
): Promise<string> {
  ensureWorker();
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data, password: opts.password });
  const pdf = await loadingTask.promise;

  const allPages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    type Item = { x: number; y: number; str: string };
    const items: Item[] = [];
    for (const it of content.items) {
      if ("str" in it && typeof it.str === "string" && it.str.length > 0) {
        items.push({ x: it.transform[4], y: -it.transform[5], str: it.str });
      }
    }
    items.sort((a, b) => a.y - b.y || a.x - b.x);

    const lines: string[] = [];
    let curY = -Infinity;
    let curParts: { x: number; str: string }[] = [];
    const flush = () => {
      if (curParts.length === 0) return;
      curParts.sort((a, b) => a.x - b.x);
      lines.push(curParts.map((p) => p.str).join(" ").replace(/\s+/g, " ").trim());
      curParts = [];
    };
    for (const it of items) {
      if (Math.abs(it.y - curY) > 3) {
        flush();
        curY = it.y;
      }
      curParts.push({ x: it.x, str: it.str });
    }
    flush();

    allPages.push(lines.filter(Boolean).join("\n"));
  }
  return allPages.join("\n\n");
}

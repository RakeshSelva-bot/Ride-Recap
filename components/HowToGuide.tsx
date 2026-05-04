"use client";

import { useState } from "react";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 ${
        open ? "rotate-180" : ""
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function AccordionItem({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-[#2A2A3D] bg-[#0F0F18]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-gray-200 transition-colors hover:bg-[#15151F] focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40"
      >
        <span>{title}</span>
        <ChevronIcon open={open} />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[#2A2A3D] px-4 py-3 text-sm leading-relaxed text-gray-400">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HowToGuide() {
  return (
    <div>
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.24em] text-[#FF6B00]">
        How to get your files?
      </h3>
      <div className="flex flex-col gap-2">
        <AccordionItem title="Google Maps Timeline JSON">
          <ol className="list-decimal space-y-1.5 pl-5 marker:text-gray-500">
            <li>Open Google Maps on your phone.</li>
            <li>
              Tap your profile photo →{" "}
              <span className="text-gray-200">Your Timeline</span>.
            </li>
            <li>
              Tap the three-dot menu →{" "}
              <span className="text-gray-200">Export Timeline data</span>.
            </li>
            <li>
              A <span className="text-gray-200">Timeline.json</span> file will be saved —
              download and upload it here.
            </li>
          </ol>
        </AccordionItem>

        <AccordionItem title="UPI Transaction History">
          <ul className="space-y-3">
            <li>
              <p className="font-medium text-gray-200">GPay</p>
              <p className="mt-0.5">
                Open GPay → Profile → Transaction History → download icon → export as CSV.
              </p>
            </li>
            <li>
              <p className="font-medium text-gray-200">PhonePe</p>
              <p className="mt-0.5">
                Open PhonePe → History → top right menu → Download Statement → select date
                range → Download PDF.
              </p>
            </li>
            <li>
              <p className="font-medium text-gray-200">Bank CSV</p>
              <p className="mt-0.5">
                Login to netbanking → Statements → download as CSV for your date range.
              </p>
            </li>
          </ul>
        </AccordionItem>
      </div>
    </div>
  );
}

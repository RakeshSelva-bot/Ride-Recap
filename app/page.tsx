import UploadForm from "@/components/UploadForm";
import { TopoBackground, LeftRail, RightRail } from "@/components/PageDecorations";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08080F] text-gray-100">
      <TopoBackground />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(60% 40% at 20% 0%, rgba(96,165,250,0.18) 0%, transparent 60%), radial-gradient(50% 35% at 90% 10%, rgba(244,114,182,0.16) 0%, transparent 60%), radial-gradient(70% 50% at 50% 100%, rgba(163,230,53,0.10) 0%, transparent 60%)",
        }}
      />
      <LeftRail />
      <RightRail />

      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16 sm:py-24">
        <header className="mb-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#60A5FA]">
            Your trips, your spends
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Travel <span className="text-[#FF6B00]">Recap</span>
          </h1>
          <p className="mt-3 text-base text-gray-400">
            Upload your Google Maps Timeline and UPI transactions to see a vivid
            summary of where you went and what you spent.
          </p>
        </header>

        <UploadForm />

        <p className="mt-12 text-xs text-gray-500">
          Your files are processed entirely in your browser. Nothing is uploaded to any server.
        </p>
      </div>
    </main>
  );
}

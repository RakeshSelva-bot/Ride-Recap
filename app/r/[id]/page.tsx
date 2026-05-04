import Link from "next/link";
import RecapLoader from "@/components/RecapLoader";
import { TopoBackground, LeftRail, RightRail } from "@/components/PageDecorations";

export const dynamic = "force-static";
export const dynamicParams = true;

export default function SharedRecapPage({ params }: { params: { id: string } }) {
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
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#FF6B00]">
            Shared recap
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Travel <span className="text-[#FF6B00]">Recap</span>
          </h1>
          <p className="mt-3 text-base text-gray-400">
            Someone shared their trip with you. Want one of your own?{" "}
            <Link href="/" className="font-medium text-[#FF6B00] hover:underline">
              Start here.
            </Link>
          </p>
        </header>

        <RecapLoader id={params.id} />

        <p className="mt-12 text-xs text-gray-500">
          Recaps are stored privately by ID. Only people with the link can view this one.
        </p>
      </div>
    </main>
  );
}

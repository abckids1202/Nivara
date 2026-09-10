import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#f8f4ee] px-5 py-12 text-[#27362d] lg:px-8 lg:py-20">
      <div className="mx-auto max-w-[860px]">
        <Link href="/" className="text-sm font-bold text-[#a6503d]">← Back home</Link>
        <p className="eyebrow mt-12">About Nivara</p>
        <h1 className="mt-4 max-w-3xl font-display text-6xl leading-[0.92] tracking-[-0.08em]">Useful can still feel personal.</h1>
        <p className="mt-8 max-w-2xl text-lg leading-8 text-[#637268]">Nivara is a single-retailer collection of practical, well-made pieces for desks, kitchens, shelves, and the first little corners that make a place feel like home.</p>
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {[["Considered", "A calm edit instead of an endless catalogue."], ["Useful", "Objects that do their job quietly and well."], ["Everyday", "Small upgrades for real homes and fresh starts."]].map(([title, copy]) => <article key={title} className="rounded-[1.5rem] bg-[#fffaf3] p-6"><h2 className="font-display text-3xl tracking-[-0.05em]">{title}</h2><p className="mt-3 text-sm leading-6 text-[#718078]">{copy}</p></article>)}
        </div>
      </div>
    </main>
  );
}

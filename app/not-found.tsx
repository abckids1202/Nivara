import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-[#f8f4ee] px-5 text-center text-[#27362d]"><div className="max-w-md"><p className="eyebrow justify-center">A quiet wrong turn</p><h1 className="mt-4 font-display text-6xl tracking-[-0.08em]">That page moved.</h1><p className="mt-5 leading-7 text-[#637268]">Try the collection or head back home and start again.</p><Link href="/" className="button-primary mt-8">Back home</Link></div></main>;
}

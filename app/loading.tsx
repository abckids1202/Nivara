export default function Loading() {
  return <main className="min-h-screen bg-[#f8f4ee] px-5 py-10" aria-busy="true" aria-label="Loading Nivara"><div className="mx-auto max-w-[1240px] animate-pulse"><div className="h-12 w-32 rounded-full bg-[#e7eee5]" /><div className="mt-16 h-16 max-w-xl rounded-2xl bg-[#e7eee5]" /><div className="mt-5 h-5 max-w-md rounded-full bg-[#e7eee5]" /><div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="aspect-[.88] rounded-[1.5rem] bg-[#e7eee5]" />)}</div></div></main>;
}

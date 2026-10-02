'use client';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f8f4ee] px-5 text-center text-[#27362d]">
      <div className="max-w-md">
        <p className="eyebrow justify-center">Something went quiet</p>
        <h1 className="mt-4 font-display text-5xl tracking-[-0.08em]">
          Let’s try that again.
        </h1>
        <p className="mt-5 leading-7 text-[#637268]">
          The page could not load this time. Your cart and account are safe.
        </p>
        <button type="button" onClick={reset} className="button-primary mt-8">
          Retry
        </button>
      </div>
    </main>
  );
}

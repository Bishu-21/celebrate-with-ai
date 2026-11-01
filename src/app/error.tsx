"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="planner-main" className="mx-auto max-w-xl px-4 py-24">
      <h1 className="font-serif text-5xl">This page could not load.</h1>
      <button type="button" className="mt-6 min-h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground" onClick={reset}>
        Try again
      </button>
    </main>
  );
}

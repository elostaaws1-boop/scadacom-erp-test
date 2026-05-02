"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Application route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-field px-4 text-ink">
      <section className="w-full max-w-lg rounded-lg border border-black/10 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-sm text-stone-600">
          Something went wrong while processing this request. Please try again or contact admin.
        </p>
        {error.digest ? <p className="mt-3 text-xs text-stone-400">Error reference: {error.digest}</p> : null}
        <button className="mt-5 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" onClick={reset} type="button">
          Try again
        </button>
      </section>
    </main>
  );
}

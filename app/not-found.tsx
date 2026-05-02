import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-field px-4 text-ink">
      <section className="w-full max-w-lg rounded-lg border border-black/10 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm text-stone-600">This page does not exist, or you do not have permission to view it.</p>
        <Link className="mt-5 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" href="/dashboard">
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}

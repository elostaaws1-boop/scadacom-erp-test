export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-field">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-mint" aria-label="Loading" role="status" />
    </main>
  );
}

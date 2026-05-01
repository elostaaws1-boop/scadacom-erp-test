import { acceptInvite } from "@/app/actions";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  async function accept(formData: FormData) {
    "use server";
    await acceptInvite(token, formData);
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-field px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-black/10 bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">Secure invite</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">Create your account</h1>
        <form action={accept} className="mt-8 space-y-4">
          <input name="email" required type="email" placeholder="Invited email address" className="w-full rounded-md border px-3 py-3" />
          <input name="name" required placeholder="Full name" className="w-full rounded-md border px-3 py-3" />
          <input name="password" required type="password" minLength={10} placeholder="Strong password" className="w-full rounded-md border px-3 py-3" />
          <button className="w-full rounded-md bg-ink px-4 py-3 font-semibold text-white">Accept invite</button>
        </form>
      </section>
    </main>
  );
}

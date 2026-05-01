import { acceptInvite } from "@/app/actions";
import { getTranslator } from "@/lib/i18n-server";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t } = await getTranslator();
  async function accept(formData: FormData) {
    "use server";
    await acceptInvite(token, formData);
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-field px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-black/10 bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">{t("pages.invite.eyebrow")}</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">{t("pages.invite.title")}</h1>
        <form action={accept} className="mt-8 space-y-4">
          <input name="email" required type="email" placeholder={t("pages.invite.invitedEmail")} className="w-full rounded-md border px-3 py-3" />
          <input name="name" required placeholder={t("common.fields.fullName")} className="w-full rounded-md border px-3 py-3" />
          <input name="password" required type="password" minLength={10} placeholder={t("pages.invite.strongPassword")} className="w-full rounded-md border px-3 py-3" />
          <button className="w-full rounded-md bg-ink px-4 py-3 font-semibold text-white">{t("common.actions.acceptInvite")}</button>
        </form>
      </section>
    </main>
  );
}

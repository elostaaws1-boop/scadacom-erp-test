import { PageHeader } from "@/components/page-header";
import { getTranslator } from "@/lib/i18n-server";
import { navigation } from "@/lib/rbac";

const extraModules = [
  { href: "/login", labelKey: "common.actions.signIn" },
  { href: "/invite/[token]", labelKey: "pages.invite.title" },
  { href: "/projects/new", labelKey: "pages.projects.newTitle" },
  { href: "/i18n-qa", labelKey: "qa.title" }
];

export default async function I18nQaPage() {
  const { t } = await getTranslator();
  const modules = [...navigation, ...extraModules];

  return (
    <>
      <PageHeader titleKey="qa.title" descriptionKey="qa.description" />
      <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
        <div className="grid gap-2">
          {modules.map((module) => (
            <div className="grid gap-2 rounded-md border border-black/10 p-3 text-sm md:grid-cols-[1fr_1fr_auto]" key={module.href}>
              <strong>{t(module.labelKey)}</strong>
              <span className="text-stone-500">{module.href}</span>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">{t("qa.usesTranslation")}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

import { ExcelImportForm } from "@/components/excel-import-form";
import { PageHeader } from "@/components/page-header";
import { getTranslator } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";

export default async function ImportsPage() {
  const { t } = await getTranslator();
  const recentImports = await prisma.auditLog.findMany({
    where: { action: "IMPORT_EXCEL" },
    orderBy: { createdAt: "desc" },
    take: 6
  });

  return (
    <>
      <PageHeader
        titleKey="pages.imports.title"
        descriptionKey="pages.imports.description"
      />
      <ExcelImportForm />
      <section className="mt-6 rounded-lg border border-black/10 bg-white p-5 text-sm shadow-sm">
        <h2 className="text-lg font-semibold text-ink">{t("pages.imports.recent")}</h2>
        <div className="mt-4 grid gap-3">
          {recentImports.length > 0 ? (
            recentImports.map((log) => {
              const details = log.after as { file?: string; imported?: number; skipped?: number } | null;
              return (
                <div className="rounded-md border border-black/10 p-3" key={log.id}>
                  <p className="font-semibold">{log.entity}</p>
                  <p className="mt-1 text-stone-600">
                    {details?.file ?? t("pages.imports.excelFile")} / {t("pages.imports.imported")} {details?.imported ?? 0}, {t("pages.imports.skipped")} {details?.skipped ?? 0} / {log.createdAt.toLocaleString("fr-MA")}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="rounded-md border border-dashed border-stone-300 p-4 text-stone-500">{t("common.empty.noImports")}</p>
          )}
        </div>
      </section>
      <section className="mt-6 rounded-lg border border-black/10 bg-white p-5 text-sm shadow-sm">
        <h2 className="text-lg font-semibold text-ink">{t("pages.imports.acceptedColumns")}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ImportHelp title={t("nav.projects")} text={t("pages.imports.projectsHelp")} />
          <ImportHelp title={t("nav.employees")} text={t("pages.imports.employeesHelp")} />
          <ImportHelp title={t("nav.fleet")} text={t("pages.imports.vehiclesHelp")} />
          <ImportHelp title={t("nav.purchases")} text={t("pages.imports.purchasesHelp")} />
          <ImportHelp title={t("nav.expenses")} text={t("pages.imports.expensesHelp")} />
          <ImportHelp title={t("pages.imports.rules")} text={t("pages.imports.rulesHelp")} />
        </div>
      </section>
    </>
  );
}

function ImportHelp({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-black/10 p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-stone-600">{text}</p>
    </div>
  );
}

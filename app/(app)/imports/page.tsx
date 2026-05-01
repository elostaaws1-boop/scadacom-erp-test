import { ExcelImportForm } from "@/components/excel-import-form";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

export default async function ImportsPage() {
  const recentImports = await prisma.auditLog.findMany({
    where: { action: "IMPORT_EXCEL" },
    orderBy: { createdAt: "desc" },
    take: 6
  });

  return (
    <>
      <PageHeader
        title="Excel Imports"
        description="Upload old Excel files and import only the fields that match ScadaCom ERP rules. Unknown columns are ignored and invalid rows are skipped with a reason."
      />
      <ExcelImportForm />
      <section className="mt-6 rounded-lg border border-black/10 bg-white p-5 text-sm shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Recent Import Attempts</h2>
        <div className="mt-4 grid gap-3">
          {recentImports.length > 0 ? (
            recentImports.map((log) => {
              const details = log.after as { file?: string; imported?: number; skipped?: number } | null;
              return (
                <div className="rounded-md border border-black/10 p-3" key={log.id}>
                  <p className="font-semibold">{log.entity}</p>
                  <p className="mt-1 text-stone-600">
                    {details?.file ?? "Excel file"} · imported {details?.imported ?? 0}, skipped {details?.skipped ?? 0} · {log.createdAt.toLocaleString("fr-MA")}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="rounded-md border border-dashed border-stone-300 p-4 text-stone-500">No import attempts recorded yet.</p>
          )}
        </div>
      </section>
      <section className="mt-6 rounded-lg border border-black/10 bg-white p-5 text-sm shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Accepted columns</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ImportHelp title="Projects" text="Project name, client, work type, technology, region, site ID, dates, status, contract value, allocated budget, priority, complexity." />
          <ImportHelp title="Employees" text="Full name, phone, role, base salary, allowance rate." />
          <ImportHelp title="Fleet vehicles" text="Plate, model, project, mileage, fuel usage, Google Maps link, location type, oil change, insurance, inspection." />
          <ImportHelp title="Purchases" text="Project, item/product, category, amount, payment method, status, notes." />
          <ImportHelp title="Expenses" text="Project, category, amount, status, notes, admin override." />
          <ImportHelp title="Rules" text="Pending rows do not affect costs. Food/hotel/personal expenses are skipped unless admin override is present." />
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

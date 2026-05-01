import { createEmployee } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { roleLabels } from "@/lib/rbac";
import { mad } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getTranslator } from "@/lib/i18n-server";

const roles = ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "PROJECT_MANAGER", "TEAM_LEADER", "TECHNICIAN", "WAREHOUSE_MANAGER", "FLEET_MANAGER"] as const;

export default async function EmployeesPage() {
  const { t } = await getTranslator();
  const employees = await prisma.employee.findMany({ orderBy: { fullName: "asc" } });
  return (
    <>
      <PageHeader titleKey="pages.employees.title" descriptionKey="pages.employees.description" />
      <form action={createEmployee} className="mb-6 grid gap-3 rounded-lg border border-black/10 bg-white p-4 shadow-sm md:grid-cols-5">
        <input name="fullName" placeholder={t("common.fields.fullName")} required className="rounded-md border px-3 py-3" />
        <input name="phone" placeholder={t("common.fields.phone")} className="rounded-md border px-3 py-3" />
        <select name="role" className="rounded-md border px-3 py-3">{roles.map((r) => <option value={r} key={r}>{t(roleLabels[r])}</option>)}</select>
        <input name="baseSalary" type="number" step="0.01" placeholder={t("pages.employees.baseSalary")} className="rounded-md border px-3 py-3" />
        <select name="allowanceRate" className="rounded-md border px-3 py-3"><option value="MAD_152">152 MAD</option><option value="MAD_160">160 MAD</option><option value="MAD_175">175 MAD</option></select>
        <button className="rounded-md bg-ink px-4 py-3 font-semibold text-white md:col-span-5">{t("pages.employees.add")}</button>
      </form>
      <div className="grid gap-3">
        {employees.map((e) => <div className="grid gap-2 rounded-lg border border-black/10 bg-white p-4 text-sm shadow-sm md:grid-cols-4" key={e.id}><strong>{e.fullName}</strong><span>{t(roleLabels[e.role])}</span><span>{mad(e.baseSalary)}</span><span>{e.allowanceRate.replace("MAD_", "")} MAD/{t("common.units.day")}</span></div>)}
      </div>
    </>
  );
}

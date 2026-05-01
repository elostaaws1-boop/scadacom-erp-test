import { createEmployee } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { roleLabels } from "@/lib/rbac";
import { mad } from "@/lib/money";
import { prisma } from "@/lib/prisma";

const roles = ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "PROJECT_MANAGER", "TEAM_LEADER", "TECHNICIAN", "WAREHOUSE_MANAGER", "FLEET_MANAGER"] as const;

export default async function EmployeesPage() {
  const employees = await prisma.employee.findMany({ orderBy: { fullName: "asc" } });
  return (
    <>
      <PageHeader title="Employees" description="Salary and deployment allowance rate are maintained per employee." />
      <form action={createEmployee} className="mb-6 grid gap-3 rounded-lg border border-black/10 bg-white p-4 shadow-sm md:grid-cols-5">
        <input name="fullName" placeholder="Full name" required className="rounded-md border px-3 py-3" />
        <input name="phone" placeholder="Phone" className="rounded-md border px-3 py-3" />
        <select name="role" className="rounded-md border px-3 py-3">{roles.map((r) => <option value={r} key={r}>{roleLabels[r]}</option>)}</select>
        <input name="baseSalary" type="number" step="0.01" placeholder="Base salary" className="rounded-md border px-3 py-3" />
        <select name="allowanceRate" className="rounded-md border px-3 py-3"><option value="MAD_152">152 MAD</option><option value="MAD_160">160 MAD</option><option value="MAD_175">175 MAD</option></select>
        <button className="rounded-md bg-ink px-4 py-3 font-semibold text-white md:col-span-5">Add employee</button>
      </form>
      <div className="grid gap-3">
        {employees.map((e) => <div className="grid gap-2 rounded-lg border border-black/10 bg-white p-4 text-sm shadow-sm md:grid-cols-4" key={e.id}><strong>{e.fullName}</strong><span>{roleLabels[e.role]}</span><span>{mad(e.baseSalary)}</span><span>{e.allowanceRate.replace("MAD_", "")} MAD/day</span></div>)}
      </div>
    </>
  );
}

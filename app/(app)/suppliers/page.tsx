import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { mad } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function SuppliersPage() {
  const suppliers = await prisma.supplier.findMany({ include: { invoices: true }, orderBy: { name: "asc" } });
  const today = new Date();
  return (
    <>
      <PageHeader titleKey="pages.suppliers.title" descriptionKey="pages.suppliers.description" />
      <div className="grid gap-4">
        {suppliers.map((supplier) => {
          const owed = supplier.invoices.reduce((sum, invoice) => sum + Number(invoice.amount) - Number(invoice.paidAmount), 0);
          const overdue = supplier.invoices.some((invoice) => invoice.dueDate < today && Number(invoice.amount) > Number(invoice.paidAmount));
          return <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm" key={supplier.id}><div className="flex justify-between gap-3"><div><h2 className="font-semibold">{supplier.name}</h2><p className="text-sm text-stone-500">{supplier.phone || supplier.email || "No contact"}</p></div><StatusBadge status={overdue ? "OVERDUE" : "UPCOMING"} /></div><p className="mt-4 text-2xl font-semibold">{mad(owed)}</p></section>;
        })}
      </div>
    </>
  );
}

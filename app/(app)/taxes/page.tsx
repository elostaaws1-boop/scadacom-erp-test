import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { mad } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function TaxesPage() {
  const taxes = await prisma.taxObligation.findMany({ orderBy: { dueDate: "asc" } });
  return (
    <>
      <PageHeader titleKey="pages.taxes.title" descriptionKey="pages.taxes.description" />
      <div className="grid gap-3">
        {taxes.map((tax) => <div className="grid gap-2 rounded-lg border border-black/10 bg-white p-4 text-sm shadow-sm md:grid-cols-5" key={tax.id}><strong>{tax.type}</strong><span>{tax.period}</span><span>Due {tax.dueDate.toLocaleDateString("fr-MA")}</span><span>{mad(Number(tax.amountDue) - Number(tax.paid))}</span><StatusBadge status={tax.status} /></div>)}
      </div>
    </>
  );
}

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { prisma } from "@/lib/prisma";

export default async function WarehousePage() {
  const items = await prisma.inventoryItem.findMany({ orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Warehouse" description="Inventory quantity, stock movement history, project links, and low-stock visibility." />
      <div className="grid gap-3">
        {items.map((item) => <div className="grid gap-2 rounded-lg border border-black/10 bg-white p-4 text-sm shadow-sm md:grid-cols-5" key={item.id}><strong>{item.name}</strong><span>{item.sku}</span><span>{item.category}</span><span>{item.quantity} units</span><StatusBadge status={item.quantity <= item.lowStockAt ? "OVERDUE" : "ACTIVE"} /></div>)}
      </div>
    </>
  );
}

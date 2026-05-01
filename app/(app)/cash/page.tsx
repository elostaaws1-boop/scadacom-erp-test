import { createCashMovement } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { mad } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function CashPage() {
  const [accounts, movements, projects] = await Promise.all([
    prisma.cashAccount.findMany(),
    prisma.cashMovement.findMany({ include: { account: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.project.findMany({ orderBy: { name: "asc" } })
  ]);
  return (
    <>
      <PageHeader title="Cash Control" description="Every payment must pass company cash control and, when linked, project budget control." />
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {accounts.map((account) => <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm" key={account.id}><p className="text-sm text-stone-500">{account.type}</p><h2 className="mt-2 text-2xl font-semibold">{account.name}: {mad(account.balance)}</h2></section>)}
      </div>
      <form action={createCashMovement} className="mb-6 grid gap-3 rounded-lg border border-black/10 bg-white p-4 shadow-sm md:grid-cols-5">
        <select name="accountId" className="rounded-md border px-3 py-3">{accounts.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}</select>
        <select name="type" className="rounded-md border px-3 py-3"><option>INCOMING</option><option>OUTGOING</option></select>
        <input name="amount" type="number" step="0.01" placeholder="Amount" required className="rounded-md border px-3 py-3" />
        <select name="projectId" className="rounded-md border px-3 py-3"><option value="">No project</option>{projects.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select>
        <input name="description" placeholder="Description" required className="rounded-md border px-3 py-3" />
        <button className="rounded-md bg-ink px-4 py-3 font-semibold text-white md:col-span-5">Record movement</button>
      </form>
      <div className="grid gap-3">
        {movements.map((m) => <div className="grid gap-2 rounded-lg border border-black/10 bg-white p-4 text-sm shadow-sm md:grid-cols-4" key={m.id}><strong>{m.type}</strong><span>{m.account.name}</span><span>{mad(m.amount)}</span><span>{m.description}</span></div>)}
      </div>
    </>
  );
}

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { mad } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { isBossIdentity } from "@/lib/rbac";

async function simulate(formData: FormData) {
  "use server";
  const session = await auth();
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? undefined;
  if (!session?.user || !isBossIdentity(session.user.role, session.user.email)) notFound();

  const passcode = String(formData.get("passcode") ?? "");
  const credential = await prisma.bossRoomCredential.findUnique({ where: { id: "boss-room" } });
  const allowed = credential ? await bcrypt.compare(passcode, credential.passcodeHash) : false;
  await prisma.bossRoomAccessLog.create({
    data: { userId: session.user.id, email: session.user.email ?? "unknown", success: allowed, ip }
  });
  if (!allowed) throw new Error("Invalid passcode");

  const revenue = Number(formData.get("revenue") ?? 0);
  const manualCost = Number(formData.get("manualCost") ?? 0);
  const totalCost = manualCost;
  const profit = revenue - totalCost;
  const marginPercent = revenue ? (profit / revenue) * 100 : 0;
  const recommendedPricing = totalCost * 1.25;
  const status = profit < 0 ? "LOSS" : marginPercent < 12 ? "RISKY" : "PROFITABLE";
  const projectId = String(formData.get("projectId") ?? "");
  if (projectId) {
    await prisma.profitScenario.create({ data: { projectId, name: String(formData.get("name") || "Scenario"), revenue, manualCost, totalCost, profit, marginPercent, breakEven: totalCost, recommendedPricing, status: status as never, createdById: session.user.id } });
  }
}

export default async function BossRoomPage() {
  const session = await auth();
  if (!session?.user || !isBossIdentity(session.user.role, session.user.email)) notFound();
  const projects = await prisma.project.findMany({ orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Boss Profit Room" description="Confidential Boss-only space. Passcode required even after login." />
      <form action={simulate} className="grid max-w-4xl gap-3 rounded-lg border border-black/10 bg-white p-5 shadow-sm md:grid-cols-2">
        <input name="passcode" type="password" placeholder="Boss room passcode" required className="rounded-md border px-3 py-3" />
        <select name="projectId" className="rounded-md border px-3 py-3"><option value="">No save</option>{projects.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select>
        <input name="name" placeholder="Best case / worst case / custom" className="rounded-md border px-3 py-3" />
        <input name="revenue" type="number" step="0.01" placeholder="Revenue MAD" required className="rounded-md border px-3 py-3" />
        <input name="manualCost" type="number" step="0.01" placeholder="Manual cost MAD" required className="rounded-md border px-3 py-3" />
        <button className="rounded-md bg-ink px-4 py-3 font-semibold text-white md:col-span-2">Run scenario</button>
      </form>
      <div className="mt-6 grid gap-4 md:grid-cols-4"><StatCard label="Target margin" value="25%" /><StatCard label="Break-even" value={mad(0)} /><StatCard label="Risk threshold" value="12%" /><StatCard label="Access" value="Boss only" /></div>
    </>
  );
}

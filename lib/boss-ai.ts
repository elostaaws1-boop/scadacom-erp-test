import { ApprovalStatus } from "@prisma/client";
import { buildMonthlyReportSnapshot, type MonthlyReportSnapshot } from "@/lib/monthly-report";
import { prisma } from "@/lib/prisma";

export type BossAiContext = {
  generatedAt: string;
  period: MonthlyReportSnapshot["period"];
  currentMonth: MonthlyReportSnapshot;
  latestLockedReport: {
    id: string;
    month: number;
    year: number;
    status: string;
    generatedAt: string | null;
  } | null;
  projectRisks: Array<{
    name: string;
    status: string;
    contractValue: number;
    actualCost: number;
    profit: number;
    margin: number;
  }>;
  supplierDebt: Array<{ supplier: string; invoice: string; outstanding: number; dueDate: string; overdue: boolean }>;
  taxes: Array<{ type: string; period: string; outstanding: number; dueDate: string; status: string; overdue: boolean }>;
  fleetAlerts: Array<{ vehicle: string; item: string; dueDate: string }>;
  warehouseAlerts: MonthlyReportSnapshot["warehouse"]["lowStockAlerts"];
  openMissions: Array<{ title: string; project: string; team: string; status: string; days: number; endDate: string | null }>;
  pendingApprovals: { expenses: number; purchases: number; advances: number };
  cashAccounts: Array<{ name: string; type: string; balance: number }>;
  dataBasis: string[];
};

export type BossAiResponse = {
  answer: string;
  model: string;
  usedFallback: boolean;
  sourceCounts: Record<string, number>;
};

export async function buildBossAiContext(date = new Date()): Promise<BossAiContext> {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  const currentMonth = await buildMonthlyReportSnapshot(month, year);
  const today = new Date();

  const [
    projects,
    supplierInvoices,
    taxObligations,
    vehicles,
    openMissions,
    pendingExpenses,
    pendingPurchases,
    pendingAdvances,
    cashAccounts,
    latestLockedReport
  ] = await Promise.all([
    prisma.project.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.supplierInvoice.findMany({ include: { supplier: true }, orderBy: { dueDate: "asc" }, take: 50 }),
    prisma.taxObligation.findMany({ orderBy: { dueDate: "asc" }, take: 50 }),
    prisma.vehicle.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.mission.findMany({
      where: { status: { not: "COMPLETED" } },
      include: { project: true, team: true },
      orderBy: { startDate: "desc" },
      take: 30
    }),
    prisma.expense.count({ where: { status: ApprovalStatus.PENDING } }),
    prisma.purchase.count({ where: { status: ApprovalStatus.PENDING } }),
    prisma.advanceRequest.count({ where: { status: ApprovalStatus.PENDING } }),
    prisma.cashAccount.findMany({ orderBy: { name: "asc" } }),
    prisma.monthlyPerformanceReport.findFirst({ where: { status: "LOCKED" }, orderBy: [{ year: "desc" }, { month: "desc" }] })
  ]);

  const projectRisks = projects
    .map((project) => {
      const contractValue = Number(project.contractValue);
      const actualCost = Number(project.actualCost);
      const profit = contractValue - actualCost;
      const margin = contractValue ? round((profit / contractValue) * 100) : 0;
      return {
        name: project.name,
        status: project.status,
        contractValue,
        actualCost,
        profit: round(profit),
        margin
      };
    })
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 12);

  const supplierDebt = supplierInvoices
    .map((invoice) => {
      const outstanding = Math.max(Number(invoice.amount) - Number(invoice.paidAmount), 0);
      return {
        supplier: invoice.supplier.name,
        invoice: invoice.number,
        outstanding: round(outstanding),
        dueDate: invoice.dueDate.toISOString(),
        overdue: invoice.dueDate < today && outstanding > 0
      };
    })
    .filter((invoice) => invoice.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 12);

  const taxes = taxObligations
    .map((tax) => {
      const outstanding = Math.max(Number(tax.amountDue) - Number(tax.paid), 0);
      return {
        type: tax.type,
        period: tax.period,
        outstanding: round(outstanding),
        dueDate: tax.dueDate.toISOString(),
        status: tax.status,
        overdue: tax.dueDate < today && outstanding > 0
      };
    })
    .filter((tax) => tax.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 12);

  const fleetAlerts = vehicles
    .flatMap((vehicle) => [
      vehicle.oilChangeDue ? { vehicle: `${vehicle.plate} ${vehicle.model}`, item: "Oil change", dueDate: vehicle.oilChangeDue.toISOString() } : null,
      vehicle.insuranceDue ? { vehicle: `${vehicle.plate} ${vehicle.model}`, item: "Insurance", dueDate: vehicle.insuranceDue.toISOString() } : null,
      vehicle.inspectionDue ? { vehicle: `${vehicle.plate} ${vehicle.model}`, item: "Inspection", dueDate: vehicle.inspectionDue.toISOString() } : null
    ])
    .filter((item): item is { vehicle: string; item: string; dueDate: string } => Boolean(item))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 12);

  return {
    generatedAt: new Date().toISOString(),
    period: currentMonth.period,
    currentMonth,
    latestLockedReport: latestLockedReport
      ? {
          id: latestLockedReport.id,
          month: latestLockedReport.month,
          year: latestLockedReport.year,
          status: latestLockedReport.status,
          generatedAt: latestLockedReport.generatedAt?.toISOString() ?? null
        }
      : null,
    projectRisks,
    supplierDebt,
    taxes,
    fleetAlerts,
    warehouseAlerts: currentMonth.warehouse.lowStockAlerts,
    openMissions: openMissions.map((mission) => ({
      title: mission.title,
      project: mission.project.name,
      team: mission.team.name,
      status: mission.status,
      days: mission.days,
      endDate: mission.endDate?.toISOString() ?? null
    })),
    pendingApprovals: { expenses: pendingExpenses, purchases: pendingPurchases, advances: pendingAdvances },
    cashAccounts: cashAccounts.map((account) => ({ name: account.name, type: account.type, balance: Number(account.balance) })),
    dataBasis: [
      "Current month generated snapshot",
      "Projects",
      "Expenses",
      "Work purchases",
      "Cash movements and accounts",
      "Suppliers and supplier invoices",
      "Tax obligations",
      "Fleet records",
      "Warehouse stock",
      "Missions",
      "Monthly performance reports"
    ]
  };
}

export async function answerBossQuestion(question: string, context: BossAiContext, locale: string): Promise<BossAiResponse> {
  const sourceCounts = {
    projects: context.projectRisks.length,
    supplierDebt: context.supplierDebt.length,
    taxes: context.taxes.length,
    fleetAlerts: context.fleetAlerts.length,
    warehouseAlerts: context.warehouseAlerts.length,
    missions: context.openMissions.length,
    reports: context.latestLockedReport ? 1 : 0
  };

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  if (!apiKey) {
    return { answer: ruleBasedAnswer(question, context), model: "rule-based-local", usedFallback: true, sourceCounts };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are SCADACOM Intelligence Assistant, a private business assistant for the Boss. Use only the provided JSON data. Do not invent figures. If data is missing, say it is missing. Always include a short 'Data basis' section and concrete recommended actions. Keep the answer concise and executive-ready."
          },
          {
            role: "user",
            content: JSON.stringify({
              answerLanguage: locale === "ar" ? "Arabic" : locale === "fr" ? "French" : "English",
              question,
              companyData: context
            })
          }
        ]
      })
    });

    if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const answer = json.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("OpenAI returned an empty answer");
    return { answer, model, usedFallback: false, sourceCounts };
  } catch {
    return { answer: ruleBasedAnswer(question, context), model: "rule-based-local", usedFallback: true, sourceCounts };
  }
}

function ruleBasedAnswer(question: string, context: BossAiContext) {
  const lower = question.toLowerCase();
  const worstProject = context.projectRisks[0];
  const highestSupplierDebt = context.supplierDebt[0];
  const highestTax = context.taxes[0];
  const highestTeamSpend = context.currentMonth.expenseAnalysis.teamSpending[0];
  const highestFuel = context.currentMonth.fleet.fuelConsumptionPerVehicle[0];
  const highInsights = context.currentMonth.insights.filter((insight) => insight.impact === "high");

  const lines = ["SCADACOM Intelligence Assistant", ""];
  lines.push("Summary:");
  if (lower.includes("supplier")) {
    lines.push(highestSupplierDebt ? `- Highest unpaid supplier debt is ${highestSupplierDebt.supplier}: ${money(highestSupplierDebt.outstanding)} on invoice ${highestSupplierDebt.invoice}.` : "- Supplier debt data is missing or no unpaid supplier debt is recorded.");
  } else if (lower.includes("tax")) {
    lines.push(highestTax ? `- Highest outstanding tax is ${highestTax.type} ${highestTax.period}: ${money(highestTax.outstanding)}.` : "- Tax debt data is missing or no outstanding tax is recorded.");
  } else if (lower.includes("team")) {
    lines.push(highestTeamSpend ? `- Highest team spending is ${highestTeamSpend.team}: ${money(highestTeamSpend.cost)} this month.` : "- Team spending data is missing for this month.");
  } else if (lower.includes("vehicle") || lower.includes("fleet") || lower.includes("fuel")) {
    lines.push(highestFuel ? `- Highest fuel usage is ${highestFuel.vehicle}: ${highestFuel.fuel}.` : "- Fleet fuel data is missing.");
    lines.push(context.fleetAlerts.length ? `- There are ${context.fleetAlerts.length} fleet maintenance alerts in the current data.` : "- No fleet maintenance alerts are visible in the current data.");
  } else {
    lines.push(`- Current month revenue is ${money(context.currentMonth.financial.totalRevenue)} and expenses are ${money(context.currentMonth.financial.totalExpenses)}.`);
    lines.push(`- Current month profit/loss is ${money(context.currentMonth.financial.totalProfit)} with ${context.currentMonth.financial.profitMargin}% margin.`);
    lines.push(worstProject ? `- Riskiest project by profit is ${worstProject.name}: ${money(worstProject.profit)} profit/loss and ${worstProject.margin}% margin.` : "- Project profitability data is missing.");
  }

  lines.push("");
  lines.push("Red flags:");
  if (highInsights.length) highInsights.slice(0, 3).forEach((insight) => lines.push(`- ${insight.title}: ${insight.description}`));
  if (context.currentMonth.alerts.critical.length) context.currentMonth.alerts.critical.slice(0, 3).forEach((alert) => lines.push(`- ${alert}`));
  if (!highInsights.length && !context.currentMonth.alerts.critical.length) lines.push("- No critical red flags were found in the summarized data.");

  lines.push("");
  lines.push("Recommended actions:");
  lines.push("- Review the lowest-margin projects before approving more spend.");
  lines.push("- Clear overdue supplier and tax items by highest outstanding amount first.");
  lines.push("- Check expenses without receipts before month close.");

  lines.push("");
  lines.push("Data basis:");
  lines.push(`- ${context.period.label} generated database snapshot.`);
  lines.push(`- Sources: ${context.dataBasis.join(", ")}.`);
  return lines.join("\n");
}

function money(value: number) {
  return `${Number(value || 0).toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

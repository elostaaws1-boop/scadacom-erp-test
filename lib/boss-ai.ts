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

export type IntelligenceSeverity = "critical" | "warning" | "info";
export type IntelligenceImpact = "high" | "medium" | "low";
export type IntelligenceConfidence = "high" | "medium" | "low";

export type IntelligenceItem = {
  id: string;
  title: string;
  description: string;
  severity: IntelligenceSeverity;
  module: "finance" | "projects" | "operations" | "fleet" | "warehouse" | "suppliers" | "taxes";
  relatedLabel?: string;
  reasoning: string;
};

export type RootCauseItem = {
  id: string;
  title: string;
  severity: IntelligenceSeverity;
  reasoning: string;
  linkedTo: {
    projects?: string[];
    teams?: string[];
    suppliers?: string[];
    vehicles?: string[];
  };
};

export type PredictionItem = {
  id: string;
  title: string;
  description: string;
  severity: IntelligenceSeverity;
  confidence: IntelligenceConfidence;
  timeEstimate: string;
  reasoning: string;
};

export type SuggestionItem = {
  id: string;
  action: string;
  reason: string;
  expectedImpact: string;
  severity: IntelligenceSeverity;
  priority: number;
  module: IntelligenceItem["module"];
  relatedLabel?: string;
};

export type BossIntelligenceLayer = {
  generatedAt: string;
  periodLabel: string;
  companyOverview: {
    cash: number;
    openProjects: number;
    monthlyExpenses: number;
    fleetAlerts: number;
    warehouseLowStock: number;
    pendingApprovals: number;
    dataNotes: string[];
  };
  redFlags: IntelligenceItem[];
  rootCauses: RootCauseItem[];
  predictions: PredictionItem[];
  suggestions: SuggestionItem[];
  roleAssistance: {
    mode: "suggest_draft_flag_only";
    controlledBy: "Boss";
    note: string;
    suggestedPrompts: string[];
  };
  dataBasis: string[];
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

export async function buildBossIntelligenceLayer(date = new Date()): Promise<BossIntelligenceLayer> {
  const context = await buildBossAiContext(date);
  return buildBossIntelligenceFromContext(context);
}

export function buildBossIntelligenceFromContext(context: BossAiContext): BossIntelligenceLayer {
  const now = new Date();
  const cash = round(context.cashAccounts.reduce((total, account) => total + account.balance, 0));
  const monthlyExpenses = round(context.currentMonth.financial.totalExpenses);
  const openProjects = context.projectRisks.filter((project) => !["COMPLETED", "CANCELLED", "ARCHIVED"].includes(project.status)).length;
  const pendingApprovals = context.pendingApprovals.advances + context.pendingApprovals.expenses + context.pendingApprovals.purchases;
  const redFlags: IntelligenceItem[] = [];
  const rootCauses: RootCauseItem[] = [];
  const predictions: PredictionItem[] = [];
  const suggestions: SuggestionItem[] = [];

  const lossProjects = context.projectRisks.filter((project) => project.profit < 0);
  const lowMarginProjects = context.projectRisks.filter((project) => project.profit >= 0 && project.margin > 0 && project.margin < 12);
  const delayedMissions = context.openMissions.filter((mission) => mission.endDate && new Date(mission.endDate) < now);
  const overdueSupplierDebt = context.supplierDebt.filter((invoice) => invoice.overdue);
  const overdueTaxes = context.taxes.filter((tax) => tax.overdue);
  const overdueFleetAlerts = context.fleetAlerts.filter((alert) => new Date(alert.dueDate) < now);
  const missingReceipts = context.currentMonth.expenseAnalysis.expensesWithoutReceipts;

  for (const project of lossProjects.slice(0, 5)) {
    redFlags.push({
      id: `loss-project-${slug(project.name)}`,
      title: "Budget exceeded",
      description: `${project.name} is showing ${money(project.profit)} profit/loss against ${money(project.contractValue)} contract value.`,
      severity: "critical",
      module: "projects",
      relatedLabel: project.name,
      reasoning: "Actual cost is higher than the contract value in the project profitability data."
    });
  }

  for (const project of lowMarginProjects.slice(0, 5)) {
    redFlags.push({
      id: `low-margin-${slug(project.name)}`,
      title: "Low project margin",
      description: `${project.name} margin is ${project.margin}%, below the 12% risk threshold.`,
      severity: "warning",
      module: "projects",
      relatedLabel: project.name,
      reasoning: "The project has profit, but the margin is too thin to absorb additional cost or delay."
    });
  }

  if (missingReceipts > 0) {
    redFlags.push({
      id: "missing-receipts",
      title: "Missing receipts",
      description: `${missingReceipts} approved or submitted expenses are missing receipts this month.`,
      severity: missingReceipts > 5 ? "critical" : "warning",
      module: "finance",
      reasoning: "Receipt gaps weaken audit evidence and can block clean month-end reporting."
    });
  }

  for (const mission of delayedMissions.slice(0, 5)) {
    redFlags.push({
      id: `delayed-mission-${slug(mission.title)}`,
      title: "Mission delayed",
      description: `${mission.title} is still ${mission.status} after its planned end date.`,
      severity: "warning",
      module: "operations",
      relatedLabel: mission.project,
      reasoning: "The mission has an end date earlier than today and is not completed."
    });
  }

  for (const invoice of overdueSupplierDebt.slice(0, 5)) {
    redFlags.push({
      id: `supplier-overdue-${slug(invoice.supplier)}-${slug(invoice.invoice)}`,
      title: "Supplier overdue",
      description: `${invoice.supplier} has unpaid invoice ${invoice.invoice} with ${money(invoice.outstanding)} outstanding.`,
      severity: invoice.outstanding >= 10000 ? "critical" : "warning",
      module: "suppliers",
      relatedLabel: invoice.supplier,
      reasoning: "The invoice due date has passed and the outstanding balance is still above zero."
    });
  }

  for (const tax of overdueTaxes.slice(0, 5)) {
    redFlags.push({
      id: `tax-overdue-${slug(tax.type)}-${slug(tax.period)}`,
      title: "Tax overdue",
      description: `${tax.type} ${tax.period} has ${money(tax.outstanding)} outstanding.`,
      severity: "critical",
      module: "taxes",
      relatedLabel: tax.type,
      reasoning: "The tax due date has passed while an unpaid balance remains."
    });
  }

  for (const alert of overdueFleetAlerts.slice(0, 5)) {
    redFlags.push({
      id: `fleet-overdue-${slug(alert.vehicle)}-${slug(alert.item)}`,
      title: "Vehicle maintenance overdue",
      description: `${alert.vehicle} needs ${alert.item}.`,
      severity: "warning",
      module: "fleet",
      relatedLabel: alert.vehicle,
      reasoning: "The maintenance due date is earlier than today."
    });
  }

  if (context.warehouseAlerts.length > 0) {
    redFlags.push({
      id: "warehouse-low-stock",
      title: "Warehouse low stock",
      description: `${context.warehouseAlerts.length} warehouse items are below minimum stock.`,
      severity: "warning",
      module: "warehouse",
      reasoning: "The warehouse stock snapshot contains low-stock alerts for this month."
    });
  }

  if (redFlags.length === 0) {
    redFlags.push({
      id: "no-red-flags",
      title: "No critical red flags detected",
      description: "The current database summary does not show critical project, finance, fleet, warehouse, supplier, or tax problems.",
      severity: "info",
      module: "finance",
      reasoning: "The intelligence layer checked the available monthly snapshot and live alert lists."
    });
  }

  if (lossProjects.length || lowMarginProjects.length) {
    rootCauses.push({
      id: "project-cost-pressure",
      title: "Project cost pressure",
      severity: lossProjects.length ? "critical" : "warning",
      reasoning: "Project margins are being reduced by actual costs approaching or exceeding contract value.",
      linkedTo: { projects: [...lossProjects, ...lowMarginProjects].slice(0, 6).map((project) => project.name) }
    });
  }

  if (delayedMissions.length) {
    rootCauses.push({
      id: "delivery-delay-pressure",
      title: "Delivery delay pressure",
      severity: "warning",
      reasoning: "Open missions past their planned end date can increase labor, vehicle, and approval costs.",
      linkedTo: {
        projects: unique(delayedMissions.map((mission) => mission.project)).slice(0, 6),
        teams: unique(delayedMissions.map((mission) => mission.team)).slice(0, 6)
      }
    });
  }

  if (overdueSupplierDebt.length || overdueTaxes.length) {
    rootCauses.push({
      id: "unpaid-obligations",
      title: "Unpaid obligations",
      severity: overdueTaxes.length ? "critical" : "warning",
      reasoning: "Overdue supplier invoices or taxes can reduce cash flexibility and create operational risk.",
      linkedTo: { suppliers: overdueSupplierDebt.slice(0, 6).map((invoice) => invoice.supplier) }
    });
  }

  if (overdueFleetAlerts.length) {
    rootCauses.push({
      id: "fleet-maintenance-backlog",
      title: "Fleet maintenance backlog",
      severity: "warning",
      reasoning: "Vehicles with overdue maintenance can create downtime and unexpected repair costs.",
      linkedTo: { vehicles: overdueFleetAlerts.slice(0, 6).map((alert) => alert.vehicle) }
    });
  }

  if (missingReceipts > 0) {
    rootCauses.push({
      id: "receipt-control-gap",
      title: "Receipt control gap",
      severity: missingReceipts > 5 ? "critical" : "warning",
      reasoning: "Expenses are being captured without full supporting documents, which increases verification workload.",
      linkedTo: {}
    });
  }

  if (rootCauses.length === 0) {
    rootCauses.push({
      id: "no-root-cause-data",
      title: "No root cause pattern detected",
      severity: "info",
      reasoning: "Available data does not show recurring project, team, supplier, vehicle, or receipt problems.",
      linkedTo: {}
    });
  }

  const cashOutflowHigher = context.currentMonth.financial.cashOutflow > context.currentMonth.financial.cashInflow;
  if (cashOutflowHigher || (monthlyExpenses > 0 && cash < monthlyExpenses)) {
    predictions.push({
      id: "cash-pressure-next-month",
      title: "Possible cash pressure",
      description: "Cash may tighten if current spending and outflow patterns continue.",
      severity: cash < monthlyExpenses ? "critical" : "warning",
      confidence: cashOutflowHigher && monthlyExpenses > 0 ? "high" : "medium",
      timeEstimate: "Next 30 days",
      reasoning: `Cash is ${money(cash)}, monthly expenses are ${money(monthlyExpenses)}, and cash outflow is ${money(context.currentMonth.financial.cashOutflow)}.`
    });
  }

  if (lossProjects.length) {
    predictions.push({
      id: "project-loss-risk",
      title: "Potential project losses",
      description: "Loss-making projects may continue reducing monthly profit unless costs are frozen or repriced.",
      severity: "critical",
      confidence: "high",
      timeEstimate: "This month",
      reasoning: `${lossProjects.length} projects currently show negative profit in the project risk list.`
    });
  }

  if (delayedMissions.length) {
    predictions.push({
      id: "mission-delay-risk",
      title: "Delivery delay risk",
      description: "Delayed missions may push cost into the next month and slow customer delivery.",
      severity: "warning",
      confidence: "medium",
      timeEstimate: "1-2 weeks",
      reasoning: `${delayedMissions.length} open missions are past their planned end date.`
    });
  }

  if (context.warehouseAlerts.length) {
    predictions.push({
      id: "stockout-risk",
      title: "Stock-out risk",
      description: "Low stock items may interrupt project execution if they are not replenished.",
      severity: "warning",
      confidence: "medium",
      timeEstimate: "Next 30 days",
      reasoning: `${context.warehouseAlerts.length} warehouse low-stock alerts are present in the monthly snapshot.`
    });
  }

  if (predictions.length === 0) {
    predictions.push({
      id: "stable-forecast",
      title: "No immediate risk predicted",
      description: "The available monthly snapshot does not show immediate cash, loss, delay, or stock-out risks.",
      severity: "info",
      confidence: "medium",
      timeEstimate: "Next 30 days",
      reasoning: "No critical red flags were found in the current intelligence categories."
    });
  }

  if (lossProjects[0]) {
    suggestions.push({
      id: "freeze-loss-project-spend",
      action: `Review and freeze non-critical spend on ${lossProjects[0].name}.`,
      reason: "It is the strongest loss-making project in the current project risk list.",
      expectedImpact: "Protect cash and prevent additional margin erosion.",
      severity: "critical",
      priority: 1,
      module: "projects",
      relatedLabel: lossProjects[0].name
    });
  }

  if (missingReceipts > 0) {
    suggestions.push({
      id: "clear-missing-receipts",
      action: "Ask teams to upload missing receipts before month close.",
      reason: `${missingReceipts} expense records are missing receipts.`,
      expectedImpact: "Cleaner approvals, stronger audit trail, and fewer finance blockers.",
      severity: missingReceipts > 5 ? "critical" : "warning",
      priority: 2,
      module: "finance"
    });
  }

  if (overdueTaxes[0]) {
    suggestions.push({
      id: "resolve-overdue-tax",
      action: `Prioritize overdue tax ${overdueTaxes[0].type} ${overdueTaxes[0].period}.`,
      reason: "Tax overdue items create compliance and cash risk.",
      expectedImpact: "Lower compliance exposure and clearer financial position.",
      severity: "critical",
      priority: 1,
      module: "taxes",
      relatedLabel: overdueTaxes[0].type
    });
  }

  if (overdueSupplierDebt[0]) {
    suggestions.push({
      id: "supplier-payment-plan",
      action: `Create a payment plan for ${overdueSupplierDebt[0].supplier}.`,
      reason: "This supplier has the highest overdue unpaid balance in the current data.",
      expectedImpact: "Reduce supplier pressure and protect future purchasing.",
      severity: overdueSupplierDebt[0].outstanding >= 10000 ? "critical" : "warning",
      priority: 2,
      module: "suppliers",
      relatedLabel: overdueSupplierDebt[0].supplier
    });
  }

  if (overdueFleetAlerts[0]) {
    suggestions.push({
      id: "schedule-fleet-maintenance",
      action: `Schedule ${overdueFleetAlerts[0].item} for ${overdueFleetAlerts[0].vehicle}.`,
      reason: "The due date has already passed.",
      expectedImpact: "Reduce breakdown risk and service disruption.",
      severity: "warning",
      priority: 3,
      module: "fleet",
      relatedLabel: overdueFleetAlerts[0].vehicle
    });
  }

  if (context.warehouseAlerts.length) {
    suggestions.push({
      id: "replenish-low-stock",
      action: "Replenish low-stock warehouse items used by active projects.",
      reason: `${context.warehouseAlerts.length} low-stock alerts exist in the warehouse snapshot.`,
      expectedImpact: "Lower project delay risk from missing materials.",
      severity: "warning",
      priority: 3,
      module: "warehouse"
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "weekly-review",
      action: "Run a weekly Boss review of projects, approvals, cash, fleet, and stock.",
      reason: "No urgent action is required from the current snapshot, but routine review keeps control tight.",
      expectedImpact: "Earlier detection of cost, approval, and operational drift.",
      severity: "info",
      priority: 5,
      module: "finance"
    });
  }

  return {
    generatedAt: context.generatedAt,
    periodLabel: context.period.label,
    companyOverview: {
      cash,
      openProjects,
      monthlyExpenses,
      fleetAlerts: context.fleetAlerts.length,
      warehouseLowStock: context.warehouseAlerts.length,
      pendingApprovals,
      dataNotes: [
        context.cashAccounts.length ? "Cash accounts loaded" : "Cash account data is missing",
        context.projectRisks.length ? "Project data loaded" : "Project data is missing",
        "Monthly report snapshot loaded"
      ]
    },
    redFlags: sortBySeverity(redFlags),
    rootCauses: sortBySeverity(rootCauses),
    predictions: sortBySeverity(predictions),
    suggestions: suggestions.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.priority - b.priority),
    roleAssistance: {
      mode: "suggest_draft_flag_only",
      controlledBy: "Boss",
      note: "The assistant can suggest, draft, and flag issues. Final decisions remain controlled by the Boss.",
      suggestedPrompts: [
        "Summarize company performance this month",
        "Show biggest red flags",
        "Which projects are risky?",
        "Where can we reduce costs?",
        "Create action plan for next week"
      ]
    },
    dataBasis: context.dataBasis
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

function sortBySeverity<T extends { severity: IntelligenceSeverity }>(items: T[]) {
  return [...items].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

function severityRank(severity: IntelligenceSeverity) {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

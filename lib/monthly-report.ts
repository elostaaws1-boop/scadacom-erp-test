import { ApprovalStatus, MovementType, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type MonthlyInsight = {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
};

export type MonthlyReportSnapshot = {
  period: { month: number; year: number; label: string; start: string; end: string };
  financial: Record<string, number>;
  comparison: Record<string, number>;
  projectPerformance: {
    totalActiveProjects: number;
    completedProjects: number;
    mostProfitableProject: string | null;
    leastProfitableProject: string | null;
    lossMakingProjects: string[];
    averageProjectMargin: number;
    profitByWorkType: Array<{ workType: string; profit: number }>;
  };
  expenseAnalysis: {
    byCategory: Array<{ category: string; total: number }>;
    topCostProjects: Array<{ project: string; cost: number }>;
    teamSpending: Array<{ team: string; cost: number }>;
    expensesWithoutReceipts: number;
  };
  operational: {
    totalMissions: number;
    completedMissions: number;
    delayedMissions: number;
    averageMissionDuration: number;
    teamEfficiency: Array<{ team: string; missions: number; cost: number; costPerMission: number }>;
  };
  supplierTax: {
    supplierPaymentsMade: number;
    supplierOverdueList: Array<{ supplier: string; number: string; outstanding: number; dueDate: string }>;
    taxesPaid: number;
    taxesOverdue: Array<{ type: string; period: string; outstanding: number; dueDate: string }>;
  };
  fleet: {
    fuelConsumptionPerVehicle: Array<{ vehicle: string; fuel: number }>;
    vehiclesWithHighestCost: Array<{ vehicle: string; cost: number }>;
    maintenanceAlerts: Array<{ vehicle: string; item: string; dueDate: string }>;
    oilChangesDone: number;
    oilChangesPending: number;
  };
  warehouse: {
    mostUsedItems: Array<{ item: string; quantity: number }>;
    lowStockAlerts: Array<{ item: string; quantity: number; lowStockAt: number }>;
    usageByProject: Array<{ project: string; quantity: number }>;
  };
  alerts: {
    redFlags: number;
    critical: string[];
    resolved: number;
    unresolved: number;
  };
  insights: MonthlyInsight[];
  forecast: {
    expectedNextMonthProfit: number;
    riskLevel: "low" | "medium" | "high";
    cashStabilityForecast: string;
  };
};

type ProjectCost = {
  id: string;
  name: string;
  workType: string;
  contractValue: number;
  actualCost: number;
  profit: number;
  margin: number;
};

const moneyCategories = ["Fuel", "Materials", "Purchases", "Vehicle", "Other"];

export function monthlyPeriod(month: number, year: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const label = start.toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" });
  return { start, end, label };
}

export function previousMonth(month: number, year: number) {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

export async function buildMonthlyReportSnapshot(month: number, year: number): Promise<MonthlyReportSnapshot> {
  const { start, end, label } = monthlyPeriod(month, year);
  const previous = previousMonth(month, year);
  const previousReport = await prisma.monthlyPerformanceReport.findUnique({
    where: { month_year: { month: previous.month, year: previous.year } }
  });
  const previousSnapshot = previousReport?.snapshot as MonthlyReportSnapshot | undefined;

  const [
    projects,
    periodProjects,
    expenses,
    purchases,
    allowances,
    movements,
    supplierInvoices,
    taxObligations,
    missions,
    vehicles,
    stockMovements,
    inventoryItems,
    auditLogs
  ] = await Promise.all([
    prisma.project.findMany(),
    prisma.project.findMany({ where: { startDate: { lt: end }, OR: [{ endDate: null }, { endDate: { gte: start } }] } }),
    prisma.expense.findMany({ where: { createdAt: { gte: start, lt: end } }, include: { project: true, mission: { include: { team: true } }, receipts: true } }),
    prisma.purchase.findMany({ where: { createdAt: { gte: start, lt: end } }, include: { project: true, mission: { include: { team: true } }, receipts: true } }),
    prisma.deploymentAllowance.findMany({ where: { createdAt: { gte: start, lt: end } }, include: { mission: { include: { project: true, team: true } } } }),
    prisma.cashMovement.findMany({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.supplierInvoice.findMany({ include: { supplier: true } }),
    prisma.taxObligation.findMany(),
    prisma.mission.findMany({ where: { startDate: { lt: end }, OR: [{ endDate: null }, { endDate: { gte: start } }] }, include: { team: true, project: true } }),
    prisma.vehicle.findMany({ include: { project: true } }),
    prisma.stockMovement.findMany({ where: { createdAt: { gte: start, lt: end } }, include: { item: true, project: true } }),
    prisma.inventoryItem.findMany(),
    prisma.auditLog.findMany({ where: { createdAt: { gte: start, lt: end } } })
  ]);

  const approvedExpenses = expenses.filter((item) => item.status === ApprovalStatus.APPROVED || item.status === ApprovalStatus.PARTIALLY_APPROVED);
  const approvedPurchases = purchases.filter((item) => item.status === ApprovalStatus.APPROVED || item.status === ApprovalStatus.PARTIALLY_APPROVED);
  const expenseTotal = approvedExpenses.reduce((sum, item) => sum + approvedAmount(item), 0);
  const purchaseTotal = approvedPurchases.reduce((sum, item) => sum + approvedAmount(item), 0);
  const allowanceTotal = allowances.reduce((sum, item) => sum + Number(item.totalMad), 0);
  const totalExpenses = expenseTotal + purchaseTotal + allowanceTotal;
  const totalRevenue = periodProjects.reduce((sum, project) => sum + Number(project.contractValue), 0);
  const totalProfit = totalRevenue - totalExpenses;
  const profitMargin = percent(totalProfit, totalRevenue);
  const cashInflow = movements.filter((item) => item.type === MovementType.INCOMING).reduce((sum, item) => sum + Number(item.amount), 0);
  const cashOutflow = movements.filter((item) => item.type === MovementType.OUTGOING).reduce((sum, item) => sum + Number(item.amount), 0);
  const supplierPaymentsTotal = movements.filter((item) => item.type === MovementType.OUTGOING && item.supplierId).reduce((sum, item) => sum + Number(item.amount), 0);
  const taxPaymentsTotal = movements.filter((item) => item.type === MovementType.OUTGOING && item.taxId).reduce((sum, item) => sum + Number(item.amount), 0);
  const outstandingSupplierDebt = supplierInvoices.reduce((sum, invoice) => sum + Math.max(Number(invoice.amount) - Number(invoice.paidAmount), 0), 0);
  const outstandingTaxes = taxObligations.reduce((sum, tax) => sum + Math.max(Number(tax.amountDue) - Number(tax.paid), 0), 0);

  const projectCosts = projects.map<ProjectCost>((project) => {
    const contractValue = Number(project.contractValue);
    const actualCost = Number(project.actualCost);
    const profit = contractValue - actualCost;
    return { id: project.id, name: project.name, workType: project.workType, contractValue, actualCost, profit, margin: percent(profit, contractValue) };
  });
  const byProfit = [...projectCosts].sort((a, b) => b.profit - a.profit);
  const profitByWorkType = groupSum(projectCosts, (item) => item.workType, (item) => item.profit).map(([workType, profit]) => ({ workType, profit }));

  const spendingRows = [
    ...approvedExpenses.map((item) => ({ category: normalizeExpenseCategory(item.category), amount: approvedAmount(item), project: item.project.name, team: item.mission?.team.name })),
    ...approvedPurchases.map((item) => ({ category: normalizeExpenseCategory(item.category || item.item), amount: approvedAmount(item), project: item.project.name, team: item.mission?.team.name })),
    ...allowances.map((item) => ({ category: "Other", amount: Number(item.totalMad), project: item.mission.project.name, team: item.mission.team.name }))
  ];
  const byCategory = moneyCategories.map((category) => ({
    category,
    total: round(spendingRows.filter((row) => row.category === category).reduce((sum, row) => sum + row.amount, 0))
  }));
  const topCostProjects = groupSum(spendingRows, (row) => row.project, (row) => row.amount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([project, cost]) => ({ project, cost: round(cost) }));
  const teamSpending = groupSum(spendingRows.filter((row) => row.team), (row) => row.team ?? "Unassigned", (row) => row.amount)
    .sort((a, b) => b[1] - a[1])
    .map(([team, cost]) => ({ team, cost: round(cost) }));
  const expensesWithoutReceipts = expenses.filter((expense) => !expense.receiptPath && expense.receipts.length === 0).length;

  const completedMissions = missions.filter((mission) => mission.status === "COMPLETED" || Boolean(mission.endDate && mission.endDate < end)).length;
  const delayedMissions = missions.filter((mission) => mission.endDate && mission.endDate > end && mission.status !== "COMPLETED").length;
  const averageMissionDuration = missions.length ? round(missions.reduce((sum, mission) => sum + mission.days, 0) / missions.length) : 0;
  const teamMissionCounts = groupSum(missions, (mission) => mission.team.name, () => 1);
  const teamEfficiency = teamMissionCounts.map(([team, count]) => {
    const cost = teamSpending.find((row) => row.team === team)?.cost ?? 0;
    return { team, missions: count, cost, costPerMission: count ? round(cost / count) : 0 };
  }).sort((a, b) => a.costPerMission - b.costPerMission);

  const today = new Date();
  const supplierOverdueList = supplierInvoices
    .filter((invoice) => invoice.dueDate < today && Number(invoice.amount) > Number(invoice.paidAmount))
    .map((invoice) => ({ supplier: invoice.supplier.name, number: invoice.number, outstanding: round(Number(invoice.amount) - Number(invoice.paidAmount)), dueDate: invoice.dueDate.toISOString() }));
  const taxesOverdue = taxObligations
    .filter((tax) => tax.dueDate < today && Number(tax.amountDue) > Number(tax.paid))
    .map((tax) => ({ type: tax.type, period: tax.period, outstanding: round(Number(tax.amountDue) - Number(tax.paid)), dueDate: tax.dueDate.toISOString() }));

  const maintenanceAlerts = vehicles.flatMap((vehicle) => [
    vehicle.oilChangeDue ? { vehicle: vehicle.plate, item: "Oil change", dueDate: vehicle.oilChangeDue.toISOString() } : null,
    vehicle.insuranceDue ? { vehicle: vehicle.plate, item: "Insurance", dueDate: vehicle.insuranceDue.toISOString() } : null,
    vehicle.inspectionDue ? { vehicle: vehicle.plate, item: "Inspection", dueDate: vehicle.inspectionDue.toISOString() } : null
  ].filter((item): item is { vehicle: string; item: string; dueDate: string } => Boolean(item && new Date(item.dueDate) <= addDays(today, 30))));
  const fuelConsumptionPerVehicle = vehicles.map((vehicle) => ({ vehicle: `${vehicle.plate} ${vehicle.model}`, fuel: Number(vehicle.fuelUsage) })).sort((a, b) => b.fuel - a.fuel);
  const vehiclesWithHighestCost = fuelConsumptionPerVehicle.slice(0, 5).map((vehicle) => ({ vehicle: vehicle.vehicle, cost: round(vehicle.fuel) }));
  const oilChangesPending = vehicles.filter((vehicle) => vehicle.oilChangeDue && vehicle.oilChangeDue <= addDays(today, 30)).length;

  const mostUsedItems = groupSum(stockMovements.filter((move) => move.type === MovementType.OUTGOING), (move) => move.item.name, (move) => move.quantity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([item, quantity]) => ({ item, quantity }));
  const lowStockAlerts = inventoryItems.filter((item) => item.quantity <= item.lowStockAt).map((item) => ({ item: item.name, quantity: item.quantity, lowStockAt: item.lowStockAt }));
  const usageByProject = groupSum(stockMovements.filter((move) => move.project), (move) => move.project?.name ?? "Unassigned", (move) => Math.abs(move.quantity))
    .sort((a, b) => b[1] - a[1])
    .map(([project, quantity]) => ({ project, quantity }));

  const critical = [
    ...projectCosts.filter((project) => project.profit < 0).map((project) => `Loss-making project: ${project.name}`),
    ...supplierOverdueList.slice(0, 5).map((invoice) => `Supplier overdue: ${invoice.supplier} ${invoice.number}`),
    ...taxesOverdue.slice(0, 5).map((tax) => `Tax overdue: ${tax.type} ${tax.period}`),
    ...lowStockAlerts.slice(0, 5).map((item) => `Low stock: ${item.item}`)
  ];
  const redFlags = critical.length + expensesWithoutReceipts + delayedMissions;
  const insights = buildInsights({
    totalRevenue,
    totalExpenses,
    totalProfit,
    profitMargin,
    outstandingSupplierDebt,
    teamEfficiency,
    fuelConsumptionPerVehicle,
    previousSnapshot
  });
  const riskLevel = redFlags > 8 || profitMargin < 5 ? "high" : redFlags > 3 || profitMargin < 15 ? "medium" : "low";

  return {
    period: { month, year, label, start: start.toISOString(), end: end.toISOString() },
    financial: {
      totalRevenue: round(totalRevenue),
      totalExpenses: round(totalExpenses),
      totalProfit: round(totalProfit),
      profitMargin: round(profitMargin),
      cashInflow: round(cashInflow),
      cashOutflow: round(cashOutflow),
      supplierPaymentsTotal: round(supplierPaymentsTotal),
      taxPaymentsTotal: round(taxPaymentsTotal),
      outstandingSupplierDebt: round(outstandingSupplierDebt),
      outstandingTaxes: round(outstandingTaxes)
    },
    comparison: {
      revenueChange: changePercent(totalRevenue, previousSnapshot?.financial.totalRevenue ?? 0),
      costChange: changePercent(totalExpenses, previousSnapshot?.financial.totalExpenses ?? 0),
      profitChange: changePercent(totalProfit, previousSnapshot?.financial.totalProfit ?? 0),
      expenseTrend: changePercent(totalExpenses, previousSnapshot?.financial.totalExpenses ?? 0),
      fuelTrend: changePercent(fuelConsumptionPerVehicle.reduce((sum, item) => sum + item.fuel, 0), previousSnapshot?.fleet.fuelConsumptionPerVehicle.reduce((sum, item) => sum + item.fuel, 0) ?? 0),
      supplierDebtTrend: changePercent(outstandingSupplierDebt, previousSnapshot?.financial.outstandingSupplierDebt ?? 0)
    },
    projectPerformance: {
      totalActiveProjects: projects.filter((project) => isOpenProjectStatus(project.status)).length,
      completedProjects: projects.filter((project) => project.status === ProjectStatus.COMPLETED).length,
      mostProfitableProject: byProfit[0]?.name ?? null,
      leastProfitableProject: byProfit.at(-1)?.name ?? null,
      lossMakingProjects: projectCosts.filter((project) => project.profit < 0).map((project) => project.name),
      averageProjectMargin: projectCosts.length ? round(projectCosts.reduce((sum, project) => sum + project.margin, 0) / projectCosts.length) : 0,
      profitByWorkType
    },
    expenseAnalysis: { byCategory, topCostProjects, teamSpending, expensesWithoutReceipts },
    operational: { totalMissions: missions.length, completedMissions, delayedMissions, averageMissionDuration, teamEfficiency },
    supplierTax: { supplierPaymentsMade: round(supplierPaymentsTotal), supplierOverdueList, taxesPaid: round(taxPaymentsTotal), taxesOverdue },
    fleet: { fuelConsumptionPerVehicle, vehiclesWithHighestCost, maintenanceAlerts, oilChangesDone: 0, oilChangesPending },
    warehouse: { mostUsedItems, lowStockAlerts, usageByProject },
    alerts: { redFlags, critical, resolved: auditLogs.filter((log) => log.action.includes("APPROVE")).length, unresolved: redFlags },
    insights,
    forecast: {
      expectedNextMonthProfit: round(totalProfit * (riskLevel === "high" ? 0.85 : riskLevel === "medium" ? 0.95 : 1.05)),
      riskLevel,
      cashStabilityForecast: cashInflow >= cashOutflow ? "Stable cash position expected" : "Cash pressure expected if outflow remains higher than inflow"
    }
  };
}

export async function generateMonthlyPerformanceReport(month: number, year: number, userId: string) {
  const existing = await prisma.monthlyPerformanceReport.findUnique({ where: { month_year: { month, year } } });
  if (existing?.status === "LOCKED") throw new Error("This monthly report is locked.");
  const snapshot = await buildMonthlyReportSnapshot(month, year);
  const { start, end } = monthlyPeriod(month, year);
  return prisma.monthlyPerformanceReport.upsert({
    where: { month_year: { month, year } },
    update: { periodStart: start, periodEnd: end, status: "GENERATED", generatedById: userId, generatedAt: new Date(), snapshot: snapshot as never },
    create: { month, year, periodStart: start, periodEnd: end, status: "GENERATED", generatedById: userId, generatedAt: new Date(), snapshot: snapshot as never }
  });
}

function approvedAmount(item: { approvedAmount: unknown; amount: unknown }) {
  return Number(item.approvedAmount ?? item.amount);
}

function isOpenProjectStatus(status: ProjectStatus) {
  return status === ProjectStatus.ACTIVE || status === ProjectStatus.PLANNED || status === ProjectStatus.ON_HOLD;
}

function normalizeExpenseCategory(category: string) {
  const value = category.toLowerCase();
  if (value.includes("fuel") || value.includes("carburant") || value.includes("gas")) return "Fuel";
  if (value.includes("material") || value.includes("mat")) return "Materials";
  if (value.includes("vehicle") || value.includes("car") || value.includes("fleet")) return "Vehicle";
  if (value.includes("purchase") || value.includes("tool") || value.includes("equipment")) return "Purchases";
  return "Other";
}

function buildInsights(input: {
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  profitMargin: number;
  outstandingSupplierDebt: number;
  teamEfficiency: Array<{ team: string; costPerMission: number }>;
  fuelConsumptionPerVehicle: Array<{ vehicle: string; fuel: number }>;
  previousSnapshot?: MonthlyReportSnapshot;
}) {
  const insights: MonthlyInsight[] = [];
  const previous = input.previousSnapshot;
  const costChange = previous ? changePercent(input.totalExpenses, previous.financial.totalExpenses) : 0;
  const profitChange = previous ? changePercent(input.totalProfit, previous.financial.totalProfit) : 0;
  const debtChange = previous ? changePercent(input.outstandingSupplierDebt, previous.financial.outstandingSupplierDebt) : 0;

  if (costChange > 15) insights.push({ title: "Costs increased", description: `Total costs increased ${round(costChange)}% compared to last month.`, impact: "high" });
  if (profitChange < -10) insights.push({ title: "Project margins decreased", description: `Profit decreased ${Math.abs(round(profitChange))}% compared to last month.`, impact: "high" });
  if (debtChange > 10) insights.push({ title: "Supplier debt increased", description: `Supplier debt increased ${round(debtChange)}% compared to last month.`, impact: "medium" });
  if (input.teamEfficiency[0]) insights.push({ title: "Most efficient team", description: `${input.teamEfficiency[0].team} has the lowest cost per mission this month.`, impact: "low" });
  if (input.fuelConsumptionPerVehicle[0]?.fuel > 0) insights.push({ title: "Highest fuel consumer", description: `${input.fuelConsumptionPerVehicle[0].vehicle} has the highest tracked fuel consumption.`, impact: "medium" });
  if (input.profitMargin < 10) insights.push({ title: "Low profit margin", description: `Company profit margin is ${round(input.profitMargin)}%.`, impact: "high" });
  if (insights.length === 0) insights.push({ title: "Stable month", description: "No major financial or operational red flags detected.", impact: "low" });
  return insights;
}

function groupSum<T>(items: T[], key: (item: T) => string, amount: (item: T) => number) {
  const map = new Map<string, number>();
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + amount(item));
  return Array.from(map.entries()).map(([label, value]) => [label, round(value)] as [string, number]);
}

function percent(value: number, base: number) {
  return base ? (value / base) * 100 : 0;
}

function changePercent(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return round(((current - previous) / Math.abs(previous)) * 100);
}

function round(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

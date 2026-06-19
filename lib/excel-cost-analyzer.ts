import ExcelJS from "exceljs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const maxMeaningfulColumns = 80;
const createManyBatchSize = 250;
const debugExcelAnalyzer = process.env.EXCEL_ANALYZER_DEBUG === "1";
const normalizeCache = new Map<string, string>();
const fieldForHeaderCache = new Map<string, ExcelCostField | null>();
const maxDbMoney = 999_999_999_999.99;
const maxDbPercent = 999_999.99;
const maxWorkDays = 10000;

export const excelCostFields = [
  "siteId",
  "siteName",
  "projectName",
  "client",
  "region",
  "date",
  "teamName",
  "teamLeader",
  "employee",
  "category",
  "description",
  "amount",
  "revenue",
  "workDays",
  "technicianCount",
  "monthlySalary",
  "teamMonthlySalary",
  "totalWorkedDays",
  "dailyAllowanceRate",
  "dailyAllowanceAmount",
  "supplier",
  "vehicle",
  "mission",
  "notes"
] as const;

export type ExcelCostField = (typeof excelCostFields)[number];
export type ExcelCostColumnMapping = Partial<Record<ExcelCostField, string>>;

export const excelCostFieldLabels: Record<ExcelCostField, string> = {
  siteId: "Site ID",
  siteName: "Site name",
  projectName: "Project name",
  client: "Client",
  region: "Region/city",
  date: "Date",
  teamName: "Team",
  teamLeader: "Team leader",
  employee: "Employee",
  category: "Category",
  description: "Description",
  amount: "Cost amount",
  revenue: "Revenue",
  workDays: "Work days",
  technicianCount: "Technicians",
  monthlySalary: "Monthly salary",
  teamMonthlySalary: "Team monthly salary",
  totalWorkedDays: "Total worked days",
  dailyAllowanceRate: "Allowance rate",
  dailyAllowanceAmount: "Allowance amount",
  supplier: "Supplier",
  vehicle: "Vehicle",
  mission: "Mission/reference",
  notes: "Notes"
};

export type ExcelCostUploadResult = {
  importId: string;
  fileName: string;
  sheetCount: number;
  rowCount: number;
  status: "UPLOADED" | "PROCESSING" | "ANALYZED" | "FAILED";
};

type ProjectMatch = {
  id: string;
  name: string;
  client: string;
  region: string;
  siteId: string;
};

type DetectedSection = {
  title: string;
  category: SiteCostCategory;
  startRow: number;
  endRow: number;
  headerRow?: number;
  merged?: boolean;
};

type PreparedSiteCostRow = {
  sheetName: string;
  rowNumber: number;
  siteId: string | null;
  siteName: string | null;
  projectName: string | null;
  client: string | null;
  region: string | null;
  matchedProjectId: string | null;
  teamName: string | null;
  teamLeader: string | null;
  workDays: number | null;
  technicianCount: number | null;
  fuelCost: number;
  highwayCost: number;
  salaryAllocatedCost: number;
  dailyAllowanceCost: number;
  purchaseCost: number;
  materialCost: number;
  toolCost: number;
  vehicleCost: number;
  paperPrintingCost: number;
  otherCost: number;
  unknownCost: number;
  totalCost: number;
  revenue: number | null;
  profitLoss: number | null;
  marginPercent: number | null;
  profitabilityStatus: "PROFITABLE" | "RISKY" | "LOSS_MAKING" | "REVENUE_MISSING";
  rawData: Record<string, string>;
  mappedData: Record<string, string | number | null>;
  warnings: string[];
  status: "PENDING" | "MATCHED" | "UNMATCHED" | "DUPLICATE" | "REJECTED" | "IMPORTED";
  duplicateKey: string | null;
};

type PreparedSheet = {
  sheetName: string;
  rowCount: number;
  headers: string[];
  detectedSections: DetectedSection[];
  rows: PreparedSiteCostRow[];
};

type SiteCostCategory =
  | "Fuel"
  | "Highway"
  | "Salary"
  | "Daily allowance"
  | "Purchases"
  | "Materials"
  | "Tools"
  | "Vehicle"
  | "Paper/printing"
  | "Warehouse"
  | "Supplier"
  | "Miscellaneous"
  | "Unknown";

const importStorageDir = path.join(process.cwd(), "storage", "excel-cost-imports");
const defaultProfileName = "SCADACOM Monthly Site Cost File";

const managerRoles: Role[] = ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"];
const approverRoles: Role[] = ["BOSS", "FINANCIAL_DEPARTMENT", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"];
const viewerRoles: Role[] = [...managerRoles, "PROJECT_MANAGER"];

export function canViewExcelCostAnalyzer(role: Role) {
  return viewerRoles.includes(role);
}

export function canManageExcelCostAnalyzer(role: Role) {
  return managerRoles.includes(role);
}

export function canApproveExcelCostImport(role: Role) {
  return approverRoles.includes(role);
}

const headerAliases: Record<ExcelCostField, string[]> = {
  siteId: ["site id", "site", "siteid", "id site", "code site", "ref site"],
  siteName: ["site name", "nom site", "site label"],
  projectName: ["project", "project name", "projet", "nom projet", "mission project"],
  client: ["client", "customer"],
  region: ["region", "city", "ville", "zone"],
  date: ["date", "la date", "payment date", "expense date", "jour", "mois"],
  teamName: ["team", "workers", "equipe", "crew"],
  teamLeader: ["team leader", "chef equipe", "chef d equipe", "leader"],
  employee: ["employee", "employe", "worker", "workers", "nom et prenom+depense", "nom et prenom depense", "technician", "technicien", "person"],
  category: ["category", "categorie", "type", "type de site", "expense type", "nature", "title", "charge"],
  description: ["description", "descreptions", "details", "detail", "item", "article", "designation", "libelle", "observation"],
  amount: ["amount", "montant", "cost", "cout", "total cost", "totale depense", "total depense", "depense totale", "prix", "total", "mad", "dh", "depense"],
  revenue: ["revenue", "income", "prix de site", "prix vente", "ca", "chiffre affaire", "facture client", "contract value"],
  workDays: ["work days", "days", "jours", "n jours", "n° jours", "nº jours", "jours travailles", "nbr jours", "nb jours"],
  technicianCount: ["technicians", "techs", "technicien", "nbr techniciens", "nb tech", "team size"],
  monthlySalary: ["monthly salary", "salaire mensuel", "salaire"],
  teamMonthlySalary: ["team monthly salary", "salaire equipe", "total salaire equipe"],
  totalWorkedDays: ["total worked days", "jours travailles mois", "total jours", "working days month"],
  dailyAllowanceRate: ["allowance rate", "taux indemnite", "indemnite/jour", "rate"],
  dailyAllowanceAmount: ["allowance amount", "indemnite", "deplacement", "per diem"],
  supplier: ["supplier", "fournisseur", "vendor"],
  vehicle: ["vehicle", "vehicule", "car", "plate", "matricule"],
  mission: ["mission", "mission ref", "reference mission", "ref"],
  notes: ["notes", "note", "comment", "commentaire"]
};

const categoryRules: Array<{ category: SiteCostCategory; terms: string[] }> = [
  { category: "Fuel", terms: ["fuel", "gasoil", "gasoile", "diesel", "essence", "carburant", "station"] },
  { category: "Highway", terms: ["peage", "péage", "jawaz", "autoroute", "toll", "highway"] },
  { category: "Salary", terms: ["salary", "salaire", "paie", "payroll", "main d oeuvre", "main doeuvre"] },
  { category: "Daily allowance", terms: ["allowance", "indemnite", "indemnité", "per diem", "perdiem", "deplacement", "déplacement"] },
  { category: "Purchases", terms: ["purchase", "achat", "achats", "buy"] },
  { category: "Materials", terms: ["material", "materiel", "matériel", "achat materiel", "achat matériel", "cable", "fiber", "fibre", "antenna", "antenne", "tube", "vis", "bolt", "connector"] },
  { category: "Tools", terms: ["tool", "outil", "location materiel", "location matériel", "perceuse", "drill", "meter", "testeur", "ladder", "echelle", "échelle"] },
  { category: "Paper/printing", terms: ["copy", "copies", "photocopie", "impression", "printing", "papier", "print"] },
  { category: "Vehicle", terms: ["vehicle", "vehicule", "véhicule", "voiture", "car", "rent car", "parking", "rocharge", "recharge", "pneu", "vidange", "oil", "garage", "maintenance"] },
  { category: "Supplier", terms: ["supplier", "fournisseur", "invoice", "facture", "vendor"] },
  { category: "Warehouse", terms: ["warehouse", "depot", "dépôt", "stock", "magasin"] },
  { category: "Miscellaneous", terms: ["misc", "miscellaneous", "divers", "autre", "other"] }
];

export async function createExcelCostImportFromFile(input: { file: File; userId: string; notes?: string; analyzeImmediately?: boolean }): Promise<ExcelCostUploadResult> {
  const extension = path.extname(input.file.name).toLowerCase();
  if (extension !== ".xlsx") throw new Error("Upload a modern .xlsx Excel file. If your file is .xls, open it in Excel and Save As .xlsx first.");
  if (input.file.size > 20 * 1024 * 1024) throw new Error("Excel file is too large. Keep uploads under 20 MB.");

  const profile = await ensureDefaultProfile();
  const created = await prisma.excelImport.create({
    data: {
      fileName: input.file.name,
      profileId: profile.id,
      uploadedById: input.userId,
      status: "UPLOADED",
      notes: input.notes || null
    }
  });

  await mkdir(importStorageDir, { recursive: true });
  const safeFileName = `${created.id}-${sanitizeFileName(input.file.name)}`;
  const relativePath = path.join("storage", "excel-cost-imports", safeFileName);
  await writeFile(path.join(process.cwd(), relativePath), Buffer.from(await input.file.arrayBuffer()));
  await prisma.excelImport.update({ where: { id: created.id }, data: { filePath: relativePath } });

  if (input.analyzeImmediately === false) {
    return {
      importId: created.id,
      fileName: input.file.name,
      sheetCount: 0,
      rowCount: 0,
      status: "UPLOADED"
    };
  }

  return analyzeExcelCostImportSafely(created.id, input.file.name, input.notes);
}

export async function analyzeExcelCostImportSafely(importId: string, fileName?: string, notes?: string): Promise<ExcelCostUploadResult> {
  await prisma.excelImport.update({ where: { id: importId }, data: { status: "PROCESSING" } }).catch(() => undefined);

  try {
    const existing = fileName ? null : await prisma.excelImport.findUnique({ where: { id: importId }, select: { fileName: true } });
    const result = await reprocessExcelCostImport(importId);
    return {
      importId,
      fileName: fileName ?? existing?.fileName ?? "Excel import",
      sheetCount: result.sheetCount,
      rowCount: result.rowCount,
      status: "ANALYZED"
    };
  } catch (error) {
    await prisma.excelImport.update({
      where: { id: importId },
      data: {
        status: "FAILED",
        notes: [notes, error instanceof Error ? error.message : "Excel analysis failed"].filter(Boolean).join("\n")
      }
    }).catch(() => undefined);
    throw error;
  }
}

export async function reprocessExcelCostImport(importId: string, options?: { selectedSheets?: string[]; columnMapping?: ExcelCostColumnMapping }) {
  debugTime("excel:load-import");
  const existing = await prisma.excelImport.findUnique({ where: { id: importId }, include: { sheets: true, profile: true } });
  debugTimeEnd("excel:load-import");
  if (!existing?.filePath) throw new Error("Import file was not found.");

  debugTime("excel:load-workbook");
  const workbook = await loadWorkbookFromStoredPath(existing.filePath);
  debugTimeEnd("excel:load-workbook");
  debugTime("excel:load-projects");
  const projects = await prisma.project.findMany({ select: { id: true, name: true, client: true, region: true, siteId: true } });
  debugTimeEnd("excel:load-projects");
  const selectedSheets = options?.selectedSheets ?? existing.sheets.filter((sheet) => sheet.selected).map((sheet) => sheet.sheetName);
  const mapping = options?.columnMapping ?? toColumnMapping(existing.columnMapping);
  debugTime("excel:prepare-workbook");
  const prepared = prepareWorkbook(workbook, projects, selectedSheets.length ? selectedSheets : undefined, mapping);
  debugTimeEnd("excel:prepare-workbook");
  const rows = prepared.flatMap((sheet) => sheet.rows);
  debugTime("excel:summarize");
  const summary = summarizePreparedRows(rows);
  debugTimeEnd("excel:summarize");

  debugTime("excel:write-db");
  await prisma.$transaction(async (tx) => {
    await tx.excelImportRow.deleteMany({ where: { importId } });
    await tx.excelSiteCostRow.deleteMany({ where: { importId } });
    await tx.excelImportSheet.deleteMany({ where: { importId } });
    await tx.excelImportSummary.deleteMany({ where: { importId } });

    for (const sheet of prepared) {
      await tx.excelImportSheet.create({
        data: {
          importId,
          sheetName: sheet.sheetName,
          selected: selectedSheets.length ? selectedSheets.includes(sheet.sheetName) : true,
          rowCount: sheet.rowCount,
          headers: sheet.headers,
          detectedSections: sheet.detectedSections
        }
      });
    }

    for (let index = 0; index < rows.length; index += createManyBatchSize) {
      const batch = rows.slice(index, index + createManyBatchSize);
      await tx.excelSiteCostRow.createMany({ data: batch.map((row) => ({ importId, ...row })) });
    }

    await tx.excelImportSummary.create({ data: { importId, ...summary } });
    await tx.excelImport.update({ where: { id: importId }, data: { status: "ANALYZED", columnMapping: mapping } });
  }, { maxWait: 10000, timeout: 60000 });
  debugTimeEnd("excel:write-db");

  return { sheetCount: prepared.length, rowCount: rows.length };
}

export async function updateExcelCostSheetSelection(input: { importId: string; selectedSheets: string[] }) {
  await reprocessExcelCostImport(input.importId, { selectedSheets: input.selectedSheets });
}

export async function updateExcelCostColumnMapping(input: { importId: string; columnMapping: ExcelCostColumnMapping }) {
  const existingSheets = await prisma.excelImportSheet.findMany({ where: { importId: input.importId, selected: true } });
  await reprocessExcelCostImport(input.importId, { selectedSheets: existingSheets.map((sheet) => sheet.sheetName), columnMapping: input.columnMapping });
}

export async function rebuildExcelCostSummary(importId: string) {
  const rows = await prisma.excelSiteCostRow.findMany({ where: { importId } });
  const preparedRows: PreparedSiteCostRow[] = rows.map((row) => ({
    sheetName: row.sheetName,
    rowNumber: row.rowNumber,
    siteId: row.siteId,
    siteName: row.siteName,
    projectName: row.projectName,
    client: row.client,
    region: row.region,
    matchedProjectId: row.matchedProjectId,
    teamName: row.teamName,
    teamLeader: row.teamLeader,
    workDays: row.workDays == null ? null : Number(row.workDays),
    technicianCount: row.technicianCount,
    fuelCost: Number(row.fuelCost),
    highwayCost: Number(row.highwayCost),
    salaryAllocatedCost: Number(row.salaryAllocatedCost),
    dailyAllowanceCost: Number(row.dailyAllowanceCost),
    purchaseCost: Number(row.purchaseCost),
    materialCost: Number(row.materialCost),
    toolCost: Number(row.toolCost),
    vehicleCost: Number(row.vehicleCost),
    paperPrintingCost: Number(row.paperPrintingCost),
    otherCost: Number(row.otherCost),
    unknownCost: Number(row.unknownCost),
    totalCost: Number(row.totalCost),
    revenue: row.revenue == null ? null : Number(row.revenue),
    profitLoss: row.profitLoss == null ? null : Number(row.profitLoss),
    marginPercent: row.marginPercent == null ? null : Number(row.marginPercent),
    profitabilityStatus: row.profitabilityStatus as PreparedSiteCostRow["profitabilityStatus"],
    rawData: row.rawData as Record<string, string>,
    mappedData: (row.mappedData as Record<string, string | number | null>) ?? {},
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    status: normalizeRowStatus(row.status),
    duplicateKey: row.duplicateKey
  }));
  const summary = summarizePreparedRows(preparedRows);
  await prisma.excelImportSummary.upsert({ where: { importId }, update: summary, create: { importId, ...summary } });
}

function prepareWorkbook(workbook: ExcelJS.Workbook, projects: ProjectMatch[], selectedSheets?: string[], manualMapping?: ExcelCostColumnMapping) {
  const preparedSheets = workbook.worksheets
    .filter((sheet) => !selectedSheets || selectedSheets.includes(sheet.name))
    .map((sheet) => prepareSheet(sheet, projects, manualMapping));

  const allRows = preparedSheets.flatMap((sheet) => sheet.rows);
  const duplicateCounts = new Map<string, number>();
  for (const row of allRows) if (row.duplicateKey) duplicateCounts.set(row.duplicateKey, (duplicateCounts.get(row.duplicateKey) ?? 0) + 1);

  const positiveCosts = allRows.map((row) => row.totalCost).filter((amount) => amount > 0);
  const averageCost = positiveCosts.length ? positiveCosts.reduce((sum, amount) => sum + amount, 0) / positiveCosts.length : 0;
  const abnormalFloor = Math.max(5000, averageCost * 3);

  for (const row of allRows) {
    if (row.duplicateKey && (duplicateCounts.get(row.duplicateKey) ?? 0) > 1) {
      row.status = "DUPLICATE";
      addFlag(row.warnings, "Duplicate expense");
    }
    if (row.totalCost > abnormalFloor) addFlag(row.warnings, "Site cost above average");
    if (row.fuelCost > 0 && averageCost > 0 && row.fuelCost > averageCost) addFlag(row.warnings, "Fuel cost above normal");
  }

  return preparedSheets;
}

function prepareSheet(sheet: ExcelJS.Worksheet, projects: ProjectMatch[], manualMapping?: ExcelCostColumnMapping): PreparedSheet {
  const detectedSections = detectSections(sheet);
  const headers = new Set<string>();
  const rows: PreparedSiteCostRow[] = [];
  let activeHeaders = new Map<number, string>();
  let activeMapping: ExcelCostColumnMapping = {};
  let activeSection: DetectedSection | null = null;

  sheet.eachRow((row, rowNumber) => {
    const section = detectedSections.find((item) => item.startRow === rowNumber);
    if (section) {
      activeSection = section;
      return;
    }

    const headerCandidate = headersFromRow(row);
    const headerScore = Array.from(headerCandidate.values()).filter((header) => exactFieldForHeader(header)).length;
    if (headerScore >= 2) {
      activeHeaders = headerCandidate;
      activeMapping = { ...mappingFromHeaders(activeHeaders), ...manualMapping };
      activeHeaders.forEach((header) => headers.add(header));
      if (activeSection) activeSection.headerRow = rowNumber;
      return;
    }
    if (!activeHeaders.size) return;

    const rawData: Record<string, string> = {};
    activeHeaders.forEach((header, columnIndex) => {
      const value = cellText(row.getCell(columnIndex).value);
      if (value) rawData[header] = value;
    });
    if (!Object.keys(rawData).length) return;

    const mapped = mapRawRow(rawData, activeMapping);
    const category = classifyCategory([mapped.category, mapped.description, mapped.supplier, activeSection?.title].filter(Boolean).join(" "));
    const amount = parseAmount(mapped.amount);
    const revenue = parseAmount(mapped.revenue);
    const workDays = clampOptional(parsePositiveNumber(mapped.workDays), maxWorkDays);
    const technicianCount = parseInteger(mapped.technicianCount);
    const monthlySalary = parseAmount(mapped.monthlySalary);
    const teamMonthlySalary = parseAmount(mapped.teamMonthlySalary);
    const totalWorkedDays = parsePositiveNumber(mapped.totalWorkedDays) ?? 26;
    const allowanceRate = parseAmount(mapped.dailyAllowanceRate) ?? inferAllowanceRate(`${mapped.description} ${mapped.notes}`) ?? 160;
    const existingAllowance = parseAmount(mapped.dailyAllowanceAmount);

    if (Object.values(mapped).every((value) => value === "" || value == null) && amount == null && revenue == null) return;

    const match = matchProject(mapped, projects);
    const costs = buildCostBreakdown({ category, amount, monthlySalary, teamMonthlySalary, totalWorkedDays, workDays, technicianCount, allowanceRate, existingAllowance });
    const totalCost = roundMoney(Object.values(costs).reduce((sum, value) => sum + value, 0));
    const profitLoss = revenue == null ? null : roundMoney(revenue - totalCost);
    const marginPercent = revenue == null || revenue === 0 ? null : clampOptional(roundMoney((profitLoss! / revenue) * 100), maxDbPercent);
    const warnings = buildWarnings({ mapped, match, category, amount, revenue, workDays, technicianCount, costs, existingAllowance, allowanceRate, totalCost, profitLoss, marginPercent });
    const profitabilityStatus = revenue == null ? "REVENUE_MISSING" : profitLoss! < 0 ? "LOSS_MAKING" : marginPercent! < 10 ? "RISKY" : "PROFITABLE";

    rows.push({
      sheetName: sheet.name,
      rowNumber,
      siteId: mapped.siteId || match?.siteId || null,
      siteName: mapped.siteName || null,
      projectName: mapped.projectName || match?.name || null,
      client: mapped.client || null,
      region: mapped.region || null,
      matchedProjectId: match?.id ?? null,
      teamName: mapped.teamName || null,
      teamLeader: mapped.teamLeader || null,
      workDays,
      technicianCount,
      ...costs,
      totalCost: clampNumber(totalCost, maxDbMoney),
      revenue: clampOptional(revenue, maxDbMoney),
      profitLoss: clampOptional(profitLoss, maxDbMoney),
      marginPercent,
      profitabilityStatus,
      rawData,
      mappedData: {
        ...mapped,
        section: activeSection?.title ?? null,
        detectedCategory: category,
        expectedDailyAllowance: workDays && technicianCount ? roundMoney(workDays * technicianCount * allowanceRate) : null,
        matchedProjectId: match?.id ?? null
      },
      warnings,
      status: match ? "MATCHED" : "UNMATCHED",
      duplicateKey: buildDuplicateKey({ siteId: mapped.siteId || match?.siteId || "", projectName: mapped.projectName || match?.name || "", amount: totalCost, description: mapped.description || category })
    });
  });

  if (!rows.length) rows.push(...fallbackParseSheetRows(sheet, projects, manualMapping, detectedSections));

  for (const section of detectedSections) section.endRow = Math.min(section.endRow || sheet.rowCount, sheet.rowCount);
  return { sheetName: sheet.name, rowCount: rows.length, headers: Array.from(headers), detectedSections, rows };
}

function fallbackParseSheetRows(sheet: ExcelJS.Worksheet, projects: ProjectMatch[], manualMapping: ExcelCostColumnMapping | undefined, detectedSections: DetectedSection[]) {
  const sectionRows = new Set(detectedSections.map((section) => section.startRow));
  let bestHeaders = new Map<number, string>();
  let bestHeaderRow = 0;
  let bestScore = 0;

  sheet.eachRow((row, rowNumber) => {
    if (sectionRows.has(rowNumber)) return;
    const candidate = headersFromRow(row);
    const score = Array.from(candidate.values()).filter((header) => exactFieldForHeader(header)).length;
    if (score > bestScore && candidate.size >= 2) {
      bestHeaders = candidate;
      bestHeaderRow = rowNumber;
      bestScore = score;
    }
  });
  if (!bestHeaders.size) return [];

  const mapping = { ...mappingFromHeaders(bestHeaders), ...manualMapping };
  const rows: PreparedSiteCostRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= bestHeaderRow || sectionRows.has(rowNumber)) return;
    const candidateScore = Array.from(headersFromRow(row).values()).filter((header) => exactFieldForHeader(header)).length;
    if (candidateScore >= 2) return;
    const rawData: Record<string, string> = {};
    bestHeaders.forEach((header, columnIndex) => {
      const value = cellText(row.getCell(columnIndex).value);
      if (value) rawData[header] = value;
    });
    const prepared = buildPreparedSiteCostRow({ sheetName: sheet.name, rowNumber, rawData, mapping, projects, sectionTitle: null });
    if (prepared) rows.push(prepared);
  });
  return rows;
}

function buildPreparedSiteCostRow(input: {
  sheetName: string;
  rowNumber: number;
  rawData: Record<string, string>;
  mapping: ExcelCostColumnMapping;
  projects: ProjectMatch[];
  sectionTitle: string | null;
}) {
  if (!Object.keys(input.rawData).length) return null;
  const mapped = mapRawRow(input.rawData, input.mapping);
  const category = classifyCategory([mapped.category, mapped.description, mapped.supplier, input.sectionTitle].filter(Boolean).join(" "));
  const amount = parseAmount(mapped.amount);
  const revenue = parseAmount(mapped.revenue);
  const workDays = clampOptional(parsePositiveNumber(mapped.workDays), maxWorkDays);
  const technicianCount = parseInteger(mapped.technicianCount);
  const monthlySalary = parseAmount(mapped.monthlySalary);
  const teamMonthlySalary = parseAmount(mapped.teamMonthlySalary);
  const totalWorkedDays = parsePositiveNumber(mapped.totalWorkedDays) ?? 26;
  const allowanceRate = parseAmount(mapped.dailyAllowanceRate) ?? inferAllowanceRate(`${mapped.description} ${mapped.notes}`) ?? 160;
  const existingAllowance = parseAmount(mapped.dailyAllowanceAmount);

  if (Object.values(mapped).every((value) => value === "" || value == null) && amount == null && revenue == null) return null;

  const match = matchProject(mapped, input.projects);
  const costs = buildCostBreakdown({ category, amount, monthlySalary, teamMonthlySalary, totalWorkedDays, workDays, technicianCount, allowanceRate, existingAllowance });
  const totalCost = roundMoney(Object.values(costs).reduce((sum, value) => sum + value, 0));
  const profitLoss = revenue == null ? null : roundMoney(revenue - totalCost);
  const marginPercent = revenue == null || revenue === 0 ? null : clampOptional(roundMoney((profitLoss! / revenue) * 100), maxDbPercent);
  const warnings = buildWarnings({ mapped, match, category, amount, revenue, workDays, technicianCount, costs, existingAllowance, allowanceRate, totalCost, profitLoss, marginPercent });
  const profitabilityStatus = revenue == null ? "REVENUE_MISSING" : profitLoss! < 0 ? "LOSS_MAKING" : marginPercent! < 10 ? "RISKY" : "PROFITABLE";

  return {
    sheetName: input.sheetName,
    rowNumber: input.rowNumber,
    siteId: mapped.siteId || match?.siteId || null,
    siteName: mapped.siteName || null,
    projectName: mapped.projectName || match?.name || null,
    client: mapped.client || null,
    region: mapped.region || null,
    matchedProjectId: match?.id ?? null,
    teamName: mapped.teamName || null,
    teamLeader: mapped.teamLeader || null,
    workDays,
    technicianCount,
    ...costs,
    totalCost: clampNumber(totalCost, maxDbMoney),
    revenue: clampOptional(revenue, maxDbMoney),
    profitLoss: clampOptional(profitLoss, maxDbMoney),
    marginPercent,
    profitabilityStatus,
    rawData: input.rawData,
    mappedData: {
      ...mapped,
      section: input.sectionTitle,
      detectedCategory: category,
      expectedDailyAllowance: workDays && technicianCount ? roundMoney(workDays * technicianCount * allowanceRate) : null,
      matchedProjectId: match?.id ?? null
    },
    warnings,
    status: match ? "MATCHED" : "UNMATCHED",
    duplicateKey: buildDuplicateKey({ siteId: mapped.siteId || match?.siteId || "", projectName: mapped.projectName || match?.name || "", amount: totalCost, description: mapped.description || category })
  } satisfies PreparedSiteCostRow;
}

function detectSections(sheet: ExcelJS.Worksheet): DetectedSection[] {
  const mergedRows = new Set<number>((sheet.model.merges ?? []).flatMap((merge) => {
    const rows = String(merge).match(/\d+/g)?.map(Number) ?? [];
    return rows;
  }));
  const sections: DetectedSection[] = [];
  let previous: DetectedSection | null = null;

  sheet.eachRow((row, rowNumber) => {
    const uniqueCells = new Set<string>();
    eachMeaningfulCell(row, (cell) => {
      const text = cellText(cell.value);
      if (text) uniqueCells.add(text);
    });
    const cells = Array.from(uniqueCells);
    const joined = cells.join(" ");
    const looksLikeTitle = cells.length > 0 && cells.length <= 3 && joined.length >= 3 && !parseAmount(joined) && !cells.some((cell) => fieldForHeader(cell));
    if (!looksLikeTitle) return;
    if (previous) previous.endRow = rowNumber - 1;
    const section: DetectedSection = {
      title: joined.slice(0, 120),
      category: classifyCategory(joined),
      startRow: rowNumber,
      endRow: sheet.rowCount,
      merged: mergedRows.has(rowNumber)
    };
    sections.push(section);
    previous = section;
  });
  return sections;
}

function buildCostBreakdown(input: {
  category: SiteCostCategory;
  amount: number | null;
  monthlySalary: number | null;
  teamMonthlySalary: number | null;
  totalWorkedDays: number;
  workDays: number | null;
  technicianCount: number | null;
  allowanceRate: number;
  existingAllowance: number | null;
}) {
  const amount = input.amount ?? 0;
  const salaryBase = input.teamMonthlySalary ?? input.monthlySalary;
  const salaryAllocatedCost = salaryBase && input.workDays ? roundMoney((salaryBase / input.totalWorkedDays) * input.workDays) : input.category === "Salary" ? amount : 0;
  const expectedAllowance = input.category === "Daily allowance" && input.workDays && input.technicianCount ? roundMoney(input.workDays * input.technicianCount * input.allowanceRate) : 0;
  const dailyAllowanceCost = input.existingAllowance ?? (input.category === "Daily allowance" && amount ? amount : expectedAllowance);

  return {
    fuelCost: clampNumber(input.category === "Fuel" ? amount : 0, maxDbMoney),
    highwayCost: clampNumber(input.category === "Highway" ? amount : 0, maxDbMoney),
    salaryAllocatedCost: clampNumber(salaryAllocatedCost, maxDbMoney),
    dailyAllowanceCost: clampNumber(dailyAllowanceCost, maxDbMoney),
    purchaseCost: clampNumber(input.category === "Purchases" ? amount : 0, maxDbMoney),
    materialCost: clampNumber(input.category === "Materials" || input.category === "Warehouse" ? amount : 0, maxDbMoney),
    toolCost: clampNumber(input.category === "Tools" ? amount : 0, maxDbMoney),
    vehicleCost: clampNumber(input.category === "Vehicle" ? amount : 0, maxDbMoney),
    paperPrintingCost: clampNumber(input.category === "Paper/printing" ? amount : 0, maxDbMoney),
    otherCost: clampNumber(input.category === "Miscellaneous" || input.category === "Supplier" ? amount : 0, maxDbMoney),
    unknownCost: clampNumber(input.category === "Unknown" ? amount : 0, maxDbMoney)
  };
}

function buildWarnings(input: {
  mapped: Record<ExcelCostField, string>;
  match: ProjectMatch | null;
  category: SiteCostCategory;
  amount: number | null;
  revenue: number | null;
  workDays: number | null;
  technicianCount: number | null;
  costs: ReturnType<typeof buildCostBreakdown>;
  existingAllowance: number | null;
  allowanceRate: number;
  totalCost: number;
  profitLoss: number | null;
  marginPercent: number | null;
}) {
  const warnings: string[] = [];
  if (!input.mapped.siteId && !input.match?.siteId) warnings.push("Missing site ID");
  if (!input.mapped.projectName && !input.match) warnings.push("Missing project");
  if (!input.match) warnings.push("Unmatched project");
  if (!input.mapped.teamName) warnings.push("Missing team");
  if (input.workDays == null) warnings.push("Missing work days");
  if (input.amount == null && input.totalCost === 0) warnings.push("Missing amount");
  if (input.amount != null && input.amount < 0) warnings.push("Negative amount");
  if (input.revenue == null) warnings.push("Missing revenue");
  if (input.category === "Unknown") warnings.push("Unknown category");
  if (input.technicianCount == null && input.costs.dailyAllowanceCost > 0) warnings.push("Missing technician count");
  if (input.existingAllowance != null && input.workDays && input.technicianCount) {
    const expected = roundMoney(input.workDays * input.technicianCount * input.allowanceRate);
    if (Math.abs(expected - input.existingAllowance) > 1) warnings.push("Daily allowance mismatch");
  }
  if (input.marginPercent != null && input.marginPercent < 10) warnings.push("Profit margin below target");
  if (input.profitLoss != null && input.profitLoss < 0) warnings.push("Loss-making site");
  return warnings;
}

function summarizePreparedRows(rows: PreparedSiteCostRow[]) {
  const usableRows = rows.filter((row) => row.status !== "DUPLICATE" && row.status !== "REJECTED");
  const redFlags: Record<string, number> = {};
  for (const row of rows) for (const flag of row.warnings) redFlags[flag] = (redFlags[flag] ?? 0) + 1;

  return {
    totalRows: rows.length,
    validRows: usableRows.length,
    duplicateRows: rows.filter((row) => row.status === "DUPLICATE").length,
    unmatchedRows: rows.filter((row) => row.status === "UNMATCHED").length,
    totalAmount: roundMoney(usableRows.reduce((sum, row) => sum + row.totalCost, 0)),
    totalCost: roundMoney(usableRows.reduce((sum, row) => sum + row.totalCost, 0)),
    totalRevenue: roundMoney(usableRows.reduce((sum, row) => sum + (row.revenue ?? 0), 0)),
    totalProfitLoss: roundMoney(usableRows.reduce((sum, row) => sum + (row.profitLoss ?? 0), 0)),
    lossMakingSitesCount: usableRows.filter((row) => row.profitabilityStatus === "LOSS_MAKING").length,
    profitableSitesCount: usableRows.filter((row) => row.profitabilityStatus === "PROFITABLE").length,
    warningCount: Object.values(redFlags).reduce((sum, count) => sum + count, 0),
    totalBySite: totalMap(usableRows, (row) => row.siteId || "Missing site"),
    totalByProject: totalMap(usableRows, (row) => row.projectName || row.matchedProjectId || "Unmatched"),
    totalByCategory: categoryTotals(usableRows),
    totalByTeam: totalMap(usableRows, (row) => row.teamName || "Missing team"),
    lossMakingSites: usableRows.filter((row) => row.profitabilityStatus === "LOSS_MAKING").slice(0, 20).map((row) => ({
      siteId: row.siteId,
      projectName: row.projectName,
      totalCost: row.totalCost,
      revenue: row.revenue,
      profitLoss: row.profitLoss
    })),
    redFlags
  };
}

function categoryTotals(rows: PreparedSiteCostRow[]) {
  return rows.reduce<Record<string, number>>((totals, row) => {
    const pairs: Array<[string, number]> = [
      ["Fuel", row.fuelCost],
      ["Highway", row.highwayCost],
      ["Salary", row.salaryAllocatedCost],
      ["Daily allowance", row.dailyAllowanceCost],
      ["Purchases", row.purchaseCost],
      ["Materials", row.materialCost],
      ["Tools", row.toolCost],
      ["Vehicle", row.vehicleCost],
      ["Paper/printing", row.paperPrintingCost],
      ["Other", row.otherCost],
      ["Unknown", row.unknownCost]
    ];
    for (const [label, value] of pairs) if (value) totals[label] = roundMoney((totals[label] ?? 0) + value);
    return totals;
  }, {});
}

function totalMap<T extends { totalCost: number }>(rows: T[], labelFor: (row: T) => string) {
  return rows.reduce<Record<string, number>>((totals, row) => {
    const label = labelFor(row) || "Missing";
    totals[label] = roundMoney((totals[label] ?? 0) + row.totalCost);
    return totals;
  }, {});
}

async function ensureDefaultProfile() {
  return prisma.excelImportProfile.upsert({
    where: { name: defaultProfileName },
    update: {},
    create: {
      name: defaultProfileName,
      description: "Section-aware SCADACOM monthly site cost workbook profile.",
      mappingRules: headerAliases,
      sectionRules: { detectMergedTitles: true, detectHeaderChanges: true },
      salaryRules: { defaultWorkedDays: 26, allocateBySiteWorkDays: true },
      allowanceRules: { defaultRate: 160, acceptedRates: [152, 160, 175], compareExistingAmounts: true },
      categoryRules
    }
  });
}

async function loadWorkbookFromStoredPath(relativePath: string) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load((await readFile(path.join(process.cwd(), relativePath))) as unknown as ArrayBuffer);
  } catch {
    throw new Error("This workbook could not be read as .xlsx. Please re-save it from Excel or LibreOffice as a valid .xlsx file and upload again.");
  }
  if (workbook.worksheets.length === 0) throw new Error("No sheets found in this Excel file.");
  return workbook;
}

function headersFromRow(row: ExcelJS.Row) {
  const headers = new Map<number, string>();
  eachMeaningfulCell(row, (cell, columnIndex) => {
    const header = cellText(cell.value);
    if (header) headers.set(columnIndex, header);
  });
  return headers;
}

function eachMeaningfulCell(row: ExcelJS.Row, callback: (cell: ExcelJS.Cell, columnIndex: number) => void) {
  const lastColumn = Math.min(maxMeaningfulColumns, row.cellCount || maxMeaningfulColumns);
  for (let columnIndex = 1; columnIndex <= lastColumn; columnIndex += 1) {
    const cell = row.getCell(columnIndex);
    if (cell.value !== null && cell.value !== undefined && cell.value !== "") callback(cell, columnIndex);
  }
}

function mappingFromHeaders(headers: Map<number, string>): ExcelCostColumnMapping {
  const mapping: ExcelCostColumnMapping = {};
  headers.forEach((header) => {
    const field = fieldForHeader(header);
    if (!field) return;
    if (!mapping[field] || isPreferredHeader(field, header, mapping[field])) mapping[field] = header;
  });
  return mapping;
}

function isPreferredHeader(field: ExcelCostField, candidate: string, current: string) {
  if (field !== "amount") return false;
  const candidateNorm = normalize(candidate);
  const currentNorm = normalize(current);
  const candidateIsTotal = candidateNorm.includes("total") || candidateNorm.includes("totale");
  const currentIsTotal = currentNorm.includes("total") || currentNorm.includes("totale");
  return candidateIsTotal && !currentIsTotal;
}

function mapRawRow(rawData: Record<string, string>, mapping: ExcelCostColumnMapping) {
  const rawHeaders = Object.keys(rawData);
  const rawByNormalized = new Map(rawHeaders.map((header) => [normalize(header), header]));
  const rawByField = new Map<ExcelCostField, string>();
  for (const header of rawHeaders) {
    const field = fieldForHeader(header);
    if (field && !rawByField.has(field)) rawByField.set(field, header);
  }
  return excelCostFields.reduce<Record<ExcelCostField, string>>((mapped, field) => {
    const manualHeader = mapping[field];
    const matchedHeader = manualHeader ? rawByNormalized.get(normalize(manualHeader)) : rawByField.get(field);
    mapped[field] = matchedHeader ? rawData[matchedHeader].trim() : "";
    return mapped;
  }, {} as Record<ExcelCostField, string>);
}

function fieldForHeader(header: string): ExcelCostField | undefined {
  const normalized = normalize(header);
  if (fieldForHeaderCache.has(normalized)) return fieldForHeaderCache.get(normalized) ?? undefined;
  const exact = exactFieldForHeader(header);
  if (exact) {
    fieldForHeaderCache.set(normalized, exact);
    return exact;
  }
  const fuzzy = excelCostFields.find((field) => headerAliases[field].some((alias) => {
    const normalizedAlias = normalize(alias);
    if (normalizedAlias.length <= 4) return false;
    return normalized.includes(normalizedAlias);
  }));
  fieldForHeaderCache.set(normalized, fuzzy ?? null);
  return fuzzy;
}

function exactFieldForHeader(header: string): ExcelCostField | undefined {
  const normalized = normalize(header);
  return excelCostFields.find((field) => headerAliases[field].some((alias) => normalize(alias) === normalized));
}

function classifyCategory(value: string): SiteCostCategory {
  const normalized = normalize(value);
  const match = categoryRules.find((rule) => rule.terms.some((term) => normalized.includes(normalize(term))));
  return match?.category ?? "Unknown";
}

function matchProject(mapped: Record<ExcelCostField, string>, projects: ProjectMatch[]) {
  const siteId = normalize(mapped.siteId);
  const projectName = normalize(mapped.projectName);
  const client = normalize(mapped.client);
  const mission = normalize(mapped.mission);
  if (siteId) {
    const exactSite = projects.find((project) => normalize(project.siteId) === siteId);
    if (exactSite) return exactSite;
  }
  if (projectName) {
    const exactName = projects.find((project) => normalize(project.name) === projectName);
    if (exactName) return exactName;
    const fuzzyName = projects.find((project) => normalize(project.name).includes(projectName) || projectName.includes(normalize(project.name)));
    if (fuzzyName) return fuzzyName;
  }
  if (client && siteId) {
    const clientSite = projects.find((project) => normalize(project.client).includes(client) && normalize(project.siteId).includes(siteId));
    if (clientSite) return clientSite;
  }
  if (mission) return projects.find((project) => normalize(project.name).includes(mission) || normalize(project.region).includes(mission)) ?? null;
  return null;
}

function parseAmount(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? roundMoney(value) : null;
  let cleaned = String(value).replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? roundMoney(amount) : null;
}

function parsePositiveNumber(value?: string) {
  const parsed = parseAmount(value);
  return parsed == null || parsed < 0 ? null : parsed;
}

function parseInteger(value?: string) {
  const parsed = parsePositiveNumber(value);
  return parsed == null ? null : Math.round(parsed);
}

function inferAllowanceRate(value: string) {
  const candidates = [152, 160, 175];
  return candidates.find((rate) => normalize(value).includes(String(rate))) ?? null;
}

function cellText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value) return String(value.text ?? "").trim();
  if (typeof value === "object" && "result" in value) return cellText(value.result as ExcelJS.CellValue);
  if (typeof value === "object" && "formula" in value) return "";
  if (typeof value === "object" && "sharedFormula" in value) return "";
  if (typeof value === "object" && "richText" in value) return ((value as { richText?: Array<{ text?: string }> }).richText ?? []).map((part) => part.text ?? "").join("").trim();
  return String(value).trim();
}

function buildDuplicateKey(input: { siteId: string; projectName: string; amount: number; description: string }) {
  if ((!input.siteId && !input.projectName) || !input.description || !input.amount) return null;
  return normalize([input.siteId || input.projectName, input.amount.toFixed(2), input.description].join("|"));
}

function debugTime(label: string) {
  if (debugExcelAnalyzer) console.time(label);
}

function debugTimeEnd(label: string) {
  if (debugExcelAnalyzer) console.timeEnd(label);
}

function toColumnMapping(value: unknown): ExcelCostColumnMapping {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  return excelCostFields.reduce<ExcelCostColumnMapping>((mapping, field) => {
    if (typeof record[field] === "string") mapping[field] = record[field];
    return mapping;
  }, {});
}

function normalizeRowStatus(status: string): PreparedSiteCostRow["status"] {
  if (status === "PENDING" || status === "MATCHED" || status === "UNMATCHED" || status === "DUPLICATE" || status === "REJECTED" || status === "IMPORTED") return status;
  return "MATCHED";
}

function addFlag(flags: string[], flag: string) {
  if (!flags.includes(flag)) flags.push(flag);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function clampNumber(value: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-max, Math.min(max, roundMoney(value)));
}

function clampOptional(value: number | null, max: number) {
  return value == null ? null : clampNumber(value, max);
}

function normalize(value: string) {
  const cached = normalizeCache.get(value);
  if (cached !== undefined) return cached;
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  normalizeCache.set(value, normalized);
  return normalized;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120);
}

"use server";

import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import path from "path";
import { ApprovalStatus, Role } from "@prisma/client";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { canAccessProject } from "@/lib/access";
import { allowanceRateToMad, canSpendProject, isForbiddenFieldExpense, missionDays, recalculateProjectCost } from "@/lib/business";
import { createInviteToken, hashToken } from "@/lib/invite";
import { prisma } from "@/lib/prisma";
import { canApprove, canOverride } from "@/lib/rbac";

async function currentUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function number(formData: FormData, key: string) {
  return Number(formData.get(key) ?? 0);
}

type ImportResult = {
  ok: boolean;
  imported: number;
  skipped: number;
  messages: string[];
};

const enumMaps = {
  client: ["MAROC_TELECOM", "INWI", "ERICSSON", "NOKIA", "OTHER"],
  workType: ["INSTALLATION", "MAINTENANCE", "UPGRADE", "DISMANTLING", "FIBER", "POWER", "CIVIL", "AUDIT"],
  technology: ["TWO_G", "THREE_G", "FOUR_G", "FIVE_G", "MICROWAVE", "FIBER", "POWER", "HYBRID"],
  projectStatus: ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"],
  approvalStatus: ["PENDING", "APPROVED", "REJECTED", "PARTIALLY_APPROVED"],
  paymentMethod: ["CASH", "BANK", "CARD", "ADVANCE"],
  locationType: ["MANUAL", "GOOGLE_MAPS", "GPS"],
  role: ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "PROJECT_MANAGER", "TEAM_LEADER", "TECHNICIAN", "WAREHOUSE_MANAGER", "FLEET_MANAGER"],
  allowanceRate: ["MAD_152", "MAD_160", "MAD_175"]
};

const headerAliases: Record<string, string[]> = {
  name: ["name", "project name", "nom projet", "projet"],
  client: ["client"],
  workType: ["work type", "type", "type travail"],
  technology: ["technology", "technologie", "tech"],
  region: ["region", "région"],
  siteId: ["site id", "site", "siteid"],
  startDate: ["start date", "date debut", "date début", "debut", "début"],
  endDate: ["end date", "date fin", "fin"],
  status: ["status", "statut"],
  contractValue: ["contract value", "contract", "revenue", "valeur contrat"],
  allocatedBudget: ["allocated budget", "budget", "budget alloué"],
  priority: ["priority", "priorité"],
  complexity: ["complexity", "complexité"],
  fullName: ["full name", "employee", "name", "nom", "technician", "technicien"],
  phone: ["phone", "tel", "telephone", "téléphone"],
  role: ["role", "rôle"],
  baseSalary: ["base salary", "salary", "salaire"],
  allowanceRate: ["allowance", "allowance rate", "indemnité", "deployment allowance"],
  plate: ["plate", "matricule", "immatriculation"],
  model: ["model", "modèle", "vehicle", "vehicule", "véhicule"],
  mileage: ["mileage", "km", "kilometrage", "kilométrage"],
  fuelUsage: ["fuel", "fuel usage", "carburant"],
  projectName: ["project", "project name", "projet"],
  item: ["item", "product", "produit", "article"],
  category: ["category", "categorie", "catégorie"],
  amount: ["amount", "price", "cost", "montant", "prix", "cout", "coût"],
  paymentMethod: ["payment", "payment method", "paiement"],
  notes: ["notes", "note", "description"],
  adminOverride: ["override", "admin override"],
  locationType: ["location type", "type location"],
  googleMapsLink: ["map", "maps", "google maps", "location"],
  oilChangeDue: ["oil", "oil change", "vidange"],
  insuranceDue: ["insurance", "assurance"],
  inspectionDue: ["inspection", "visite technique"]
};

async function assertFieldMissionAccess(user: { id: string; role: Role }, missionId: string | null, projectId: string) {
  if (!["TEAM_LEADER", "TECHNICIAN"].includes(user.role)) return;
  if (!missionId) throw new Error("Mission is required in the technician app.");

  const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
  if (!employee) throw new Error("No employee profile is linked to this user.");

  const mission = await prisma.mission.findFirst({
    where: {
      id: missionId,
      projectId,
      OR: [
        { technicians: { some: { employeeId: employee.id } } },
        ...(user.role === "TEAM_LEADER" ? [{ team: { leaderId: employee.id } }] : [])
      ]
    }
  });
  if (!mission) throw new Error("This mission is not assigned to you.");
}

async function assertTeamLeaderMissionAccess(user: { id: string; role: Role }, missionId: string) {
  if (user.role !== "TEAM_LEADER" && user.role !== "BOSS" && user.role !== "SUPER_ADMIN") throw new Error("Only team leaders can assign vehicles from the technician app.");
  if (user.role === "BOSS" || user.role === "SUPER_ADMIN") return;
  const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
  if (!employee) throw new Error("No employee profile is linked to this team leader.");
  const mission = await prisma.mission.findFirst({ where: { id: missionId, team: { leaderId: employee.id } } });
  if (!mission) throw new Error("This mission is not led by you.");
}

async function saveReceiptPhotos(formData: FormData) {
  const receiptUrl = text(formData, "receiptPath");
  const receiptPhotos = formData
    .getAll("receiptPhotos")
    .filter((receiptPhoto): receiptPhoto is File => receiptPhoto instanceof File && receiptPhoto.size > 0);
  const receiptCosts = formData.getAll("receiptCosts").map((value) => Number(value));
  const receiptNotes = formData.getAll("receiptNotes").map((value) => String(value ?? "").trim());
  const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./uploads");
  const saved: Array<{ filePath: string; fileName: string; mimeType: string; sizeBytes: number; costMad: number; note?: string }> = [];

  if (receiptUrl) {
    const costMad = receiptCosts[0];
    if (!costMad || costMad <= 0) throw new Error("Receipt cost is required.");
    saved.push({ filePath: receiptUrl, fileName: path.basename(receiptUrl), mimeType: "external/link", sizeBytes: 0, costMad, note: receiptNotes[0] || undefined });
  }

  if (receiptPhotos.length > 0) await mkdir(uploadDir, { recursive: true });
  for (const [index, receiptPhoto] of receiptPhotos.entries()) {
    if (!receiptPhoto.type.startsWith("image/")) throw new Error("Receipt photos must be images.");
    const costIndex = receiptUrl ? index + 1 : index;
    const costMad = receiptCosts[costIndex];
    if (!costMad || costMad <= 0) throw new Error("Each receipt photo needs a cost.");
    const extension = path.extname(receiptPhoto.name) || ".jpg";
    const safeName = `${Date.now()}-${randomUUID()}${extension}`.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(uploadDir, safeName);
    await writeFile(filePath, Buffer.from(await receiptPhoto.arrayBuffer()));
    saved.push({
      filePath,
      fileName: receiptPhoto.name || safeName,
      mimeType: receiptPhoto.type || "image/jpeg",
      sizeBytes: receiptPhoto.size,
      costMad,
      note: receiptNotes[costIndex] || undefined
    });
  }

  return saved;
}

export async function createProject(formData: FormData) {
  const user = await currentUser();
  if (!["BOSS", "GENERAL_MANAGER", "SUPER_ADMIN", "ADMIN"].includes(user.role)) throw new Error("Only Boss or General Manager can create projects.");
  const project = await prisma.project.create({
    data: {
      name: text(formData, "name"),
      client: text(formData, "client") as never,
      workType: text(formData, "workType") as never,
      technology: text(formData, "technology") as never,
      region: text(formData, "region"),
      siteId: text(formData, "siteId"),
      startDate: new Date(text(formData, "startDate")),
      endDate: text(formData, "endDate") ? new Date(text(formData, "endDate")) : null,
      status: text(formData, "status") as never,
      contractValue: number(formData, "contractValue"),
      allocatedBudget: number(formData, "allocatedBudget"),
      priority: number(formData, "priority"),
      complexity: number(formData, "complexity")
    }
  });
  await audit({ actorId: user.id, action: "CREATE", entity: "Project", entityId: project.id, after: project });
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function createEmployee(formData: FormData) {
  const user = await currentUser();
  if (!["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"].includes(user.role)) throw new Error("Not allowed");
  const employee = await prisma.employee.create({
    data: {
      fullName: text(formData, "fullName"),
      phone: text(formData, "phone"),
      role: text(formData, "role") as Role,
      baseSalary: number(formData, "baseSalary"),
      allowanceRate: text(formData, "allowanceRate") as never
    }
  });
  await audit({ actorId: user.id, action: "CREATE", entity: "Employee", entityId: employee.id, after: employee });
  revalidatePath("/employees");
}

export async function createTeam(formData: FormData) {
  const user = await currentUser();
  if (!["BOSS", "GENERAL_MANAGER", "SUPER_ADMIN", "ADMIN"].includes(user.role)) throw new Error("Not allowed");
  const memberIds = formData.getAll("memberIds").map(String).filter(Boolean);
  const team = await prisma.team.create({
    data: {
      name: text(formData, "name"),
      leaderId: text(formData, "leaderId") || null,
      members: { create: memberIds.map((employeeId) => ({ employeeId })) }
    }
  });
  await audit({ actorId: user.id, action: "CREATE", entity: "Team", entityId: team.id, after: { ...team, memberIds } });
  revalidatePath("/teams");
}

export async function createMission(formData: FormData) {
  const user = await currentUser();
  if (!["BOSS", "GENERAL_MANAGER", "PROJECT_MANAGER", "SUPER_ADMIN", "ADMIN"].includes(user.role)) throw new Error("Not allowed");
  if (!(await canAccessProject(user, text(formData, "projectId")))) throw new Error("Not allowed for this project.");
  const startDate = new Date(text(formData, "startDate"));
  const endDate = text(formData, "endDate") ? new Date(text(formData, "endDate")) : null;
  const teamId = text(formData, "teamId");
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { members: { include: { employee: true } } } });
  if (!team) throw new Error("Team not found");
  const days = endDate ? missionDays(startDate, endDate) : 1;
  const mission = await prisma.mission.create({
    data: {
      projectId: text(formData, "projectId"),
      teamId,
      title: text(formData, "title"),
      location: text(formData, "location"),
      startDate,
      endDate,
      days,
      teamLocked: true,
      technicians: {
        create: team.members.map((member) => ({ employeeId: member.employeeId, locked: true }))
      },
      allowances: {
        create: team.members.map((member) => {
          const rate = allowanceRateToMad(member.employee.allowanceRate);
          return { employeeId: member.employeeId, days, rateMad: rate, totalMad: rate * days };
        })
      }
    }
  });
  await recalculateProjectCost(mission.projectId);
  await audit({ actorId: user.id, action: "CREATE_LOCKED", entity: "Mission", entityId: mission.id, after: mission });
  revalidatePath("/missions");
}

export async function submitPurchase(formData: FormData) {
  const user = await currentUser();
  const projectId = text(formData, "projectId");
  const missionId = text(formData, "missionId") || null;
  await assertFieldMissionAccess(user, missionId, projectId);
  const receipts = await saveReceiptPhotos(formData);
  const purchase = await prisma.purchase.create({
    data: {
      projectId,
      missionId,
      submittedById: user.id,
      item: text(formData, "item"),
      category: text(formData, "category"),
      amount: number(formData, "amount"),
      paymentMethod: text(formData, "paymentMethod") as never,
      receiptPath: receipts[0]?.filePath ?? null,
      notes: text(formData, "notes"),
      receipts: { create: receipts }
    }
  });
  await audit({ actorId: user.id, action: "SUBMIT", entity: "Purchase", entityId: purchase.id, after: purchase });
  revalidatePath("/purchases");
  revalidatePath("/technician");
}

export async function submitExpense(formData: FormData) {
  const user = await currentUser();
  const projectId = text(formData, "projectId");
  const missionId = text(formData, "missionId") || null;
  await assertFieldMissionAccess(user, missionId, projectId);
  const category = text(formData, "category");
  const adminOverride = formData.get("adminOverride") === "on";
  if (isForbiddenFieldExpense(category, adminOverride)) {
    throw new Error("Food, hotel, and personal expenses are covered by deployment allowance and require admin override.");
  }
  const receipts = await saveReceiptPhotos(formData);
  const expense = await prisma.expense.create({
    data: {
      projectId,
      missionId,
      submittedById: user.id,
      category,
      amount: number(formData, "amount"),
      adminOverride,
      receiptPath: receipts[0]?.filePath ?? null,
      notes: text(formData, "notes"),
      receipts: { create: receipts }
    }
  });
  await audit({ actorId: user.id, action: "SUBMIT", entity: "Expense", entityId: expense.id, after: expense });
  revalidatePath("/expenses");
  revalidatePath("/technician");
}

export async function requestAdvance(formData: FormData) {
  const user = await currentUser();
  const amount = number(formData, "amount");
  const projectId = text(formData, "projectId");
  const missionId = text(formData, "missionId") || null;
  await assertFieldMissionAccess(user, missionId, projectId);
  const check = await canSpendProject(projectId, amount, user.role);
  if (!check.ok) throw new Error("Advance blocked: project budget or company cash is not available.");
  const advance = await prisma.advanceRequest.create({
    data: {
      projectId,
      missionId,
      requestedById: user.id,
      category: text(formData, "category"),
      amount,
      reason: text(formData, "reason"),
      overrideById: check.needsOverride ? user.id : null
    }
  });
  await audit({ actorId: user.id, action: check.needsOverride ? "REQUEST_WITH_OVERRIDE" : "REQUEST", entity: "AdvanceRequest", entityId: advance.id, after: advance });
  revalidatePath("/advances");
  revalidatePath("/technician");
}

export async function assignMissionVehicle(formData: FormData) {
  const user = await currentUser();
  const missionId = text(formData, "missionId");
  const vehicleId = text(formData, "vehicleId");
  await assertTeamLeaderMissionAccess(user, missionId);
  const before = await prisma.mission.findUniqueOrThrow({ where: { id: missionId } });
  const updated = await prisma.mission.update({
    where: { id: missionId },
    data: { vehicleId: vehicleId || null }
  });
  await audit({ actorId: user.id, action: "ASSIGN_VEHICLE", entity: "Mission", entityId: missionId, before, after: updated });
  revalidatePath("/technician");
  revalidatePath("/missions");
}

function canManageFleet(role: Role) {
  return ["BOSS", "GENERAL_MANAGER", "SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"].includes(role);
}

export async function createVehicle(formData: FormData) {
  const user = await currentUser();
  if (!canManageFleet(user.role)) throw new Error("Not allowed");
  const vehicle = await prisma.vehicle.create({
    data: {
      plate: text(formData, "plate").toUpperCase(),
      model: text(formData, "model"),
      driverId: text(formData, "driverId") || null,
      projectId: text(formData, "projectId") || null,
      mileage: number(formData, "mileage"),
      fuelUsage: number(formData, "fuelUsage"),
      googleMapsLink: text(formData, "googleMapsLink") || null,
      latitude: text(formData, "latitude") ? number(formData, "latitude") : null,
      longitude: text(formData, "longitude") ? number(formData, "longitude") : null,
      locationType: text(formData, "locationType") as never,
      oilChangeDue: text(formData, "oilChangeDue") ? new Date(text(formData, "oilChangeDue")) : null,
      insuranceDue: text(formData, "insuranceDue") ? new Date(text(formData, "insuranceDue")) : null,
      inspectionDue: text(formData, "inspectionDue") ? new Date(text(formData, "inspectionDue")) : null
    }
  });
  await audit({ actorId: user.id, action: "CREATE", entity: "Vehicle", entityId: vehicle.id, after: vehicle });
  revalidatePath("/fleet");
}

export async function updateVehicle(formData: FormData) {
  const user = await currentUser();
  if (!canManageFleet(user.role)) throw new Error("Not allowed");
  const id = text(formData, "id");
  const before = await prisma.vehicle.findUniqueOrThrow({ where: { id } });
  const updated = await prisma.vehicle.update({
    where: { id },
    data: {
      plate: text(formData, "plate").toUpperCase(),
      model: text(formData, "model"),
      driverId: text(formData, "driverId") || null,
      projectId: text(formData, "projectId") || null,
      mileage: number(formData, "mileage"),
      fuelUsage: number(formData, "fuelUsage"),
      googleMapsLink: text(formData, "googleMapsLink") || null,
      latitude: text(formData, "latitude") ? number(formData, "latitude") : null,
      longitude: text(formData, "longitude") ? number(formData, "longitude") : null,
      locationType: text(formData, "locationType") as never,
      oilChangeDue: text(formData, "oilChangeDue") ? new Date(text(formData, "oilChangeDue")) : null,
      insuranceDue: text(formData, "insuranceDue") ? new Date(text(formData, "insuranceDue")) : null,
      inspectionDue: text(formData, "inspectionDue") ? new Date(text(formData, "inspectionDue")) : null
    }
  });
  await audit({ actorId: user.id, action: "UPDATE", entity: "Vehicle", entityId: id, before, after: updated });
  revalidatePath("/fleet");
  revalidatePath("/technician");
}

export async function importExcelData(_previous: ImportResult, formData: FormData): Promise<ImportResult> {
  try {
    const user = await currentUser();
    if (!["BOSS", "GENERAL_MANAGER", "PROJECT_MANAGER", "FINANCIAL_DEPARTMENT", "FLEET_MANAGER", "WAREHOUSE_MANAGER", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"].includes(user.role)) {
      return { ok: false, imported: 0, skipped: 0, messages: ["Your role is not allowed to import Excel files."] };
    }

    const file = formData.get("file");
    const importType = text(formData, "importType") as "projects" | "employees" | "vehicles" | "purchases" | "expenses";
    if (!(file instanceof File) || file.size === 0) return { ok: false, imported: 0, skipped: 0, messages: ["Upload an Excel file."] };
    if (!file.name.toLowerCase().endsWith(".xlsx")) return { ok: false, imported: 0, skipped: 0, messages: ["Only .xlsx files are supported. Save old Excel files as .xlsx first."] };

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet) return { ok: false, imported: 0, skipped: 0, messages: ["No worksheet found in this file."] };

    const { rows, recognizedHeaders } = worksheetRows(sheet);
    if (recognizedHeaders.length === 0) {
      return {
        ok: false,
        imported: 0,
        skipped: 0,
        messages: ["No recognized ERP columns found in row 1. The first row must contain headers like Project name, Site ID, Amount, Category, Plate, Model, etc."]
      };
    }
    if (rows.length === 0) {
      return {
        ok: false,
        imported: 0,
        skipped: 0,
        messages: [`Recognized columns: ${recognizedHeaders.join(", ")}. No usable data rows found below the header.`]
      };
    }

    let imported = 0;
    let skipped = 0;
    const messages: string[] = [`Recognized columns: ${recognizedHeaders.join(", ")}`];

    for (const [index, row] of rows.entries()) {
      try {
        if (importType === "projects") await importProjectRow(row);
        if (importType === "employees") await importEmployeeRow(row);
        if (importType === "vehicles") await importVehicleRow(row);
        if (importType === "purchases") await importPurchaseRow(row, user.id);
        if (importType === "expenses") await importExpenseRow(row, user.id);
        imported += 1;
      } catch (error) {
        skipped += 1;
        messages.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "Skipped"}`);
      }
    }

    await audit({
      actorId: user.id,
      action: "IMPORT_EXCEL",
      entity: importType,
      after: { file: file.name, imported, skipped }
    });

    if (importType === "projects") revalidatePath("/projects");
    if (importType === "employees") revalidatePath("/employees");
    if (importType === "vehicles") revalidatePath("/fleet");
    if (importType === "purchases") revalidatePath("/purchases");
    if (importType === "expenses") revalidatePath("/expenses");
    revalidatePath("/imports");

    return {
      ok: skipped === 0 && imported > 0,
      imported,
      skipped,
      messages: messages.slice(0, 14)
    };
  } catch (error) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      messages: [error instanceof Error ? error.message : "Import failed. Check that the file is a valid .xlsx workbook."]
    };
  }
}

function worksheetRows(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  const headers = headerRow.values as ExcelJS.CellValue[];
  const indexToKey = new Map<number, string>();
  headers.forEach((value, index) => {
    const key = canonicalHeader(String(value ?? ""));
    if (key) indexToKey.set(index, key);
  });

  const rows: Array<Record<string, string>> = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    indexToKey.forEach((key, index) => {
      const value = row.getCell(index).value;
      const parsed = cellText(value);
      if (parsed !== "") record[key] = parsed;
    });
    if (Object.keys(record).length > 0) rows.push(record);
  });
  return { rows, recognizedHeaders: Array.from(new Set(indexToKey.values())) };
}

function canonicalHeader(header: string) {
  const normalized = normalize(header);
  return Object.entries(headerAliases).find(([, aliases]) => aliases.some((alias) => normalize(alias) === normalized))?.[0];
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cellText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value) return String(value.text ?? "").trim();
  if (typeof value === "object" && "result" in value) return String(value.result ?? "").trim();
  return String(value).trim();
}

function required(row: Record<string, string>, key: string) {
  const value = row[key]?.trim();
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

function optionalNumber(row: Record<string, string>, key: string, fallback = 0) {
  const value = row[key];
  if (!value) return fallback;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalDate(row: Record<string, string>, key: string) {
  const value = row[key];
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pickEnum(value: string | undefined, allowed: string[], fallback: string) {
  if (!value) return fallback;
  const normalized = normalize(value).replace(/\s/g, "_").toUpperCase();
  const compact = normalized.replace(/^2G$/, "TWO_G").replace(/^3G$/, "THREE_G").replace(/^4G$/, "FOUR_G").replace(/^5G$/, "FIVE_G");
  return allowed.includes(compact) ? compact : fallback;
}

async function findProject(row: Record<string, string>) {
  const projectName = row.projectName || row.name;
  if (!projectName) throw new Error("Missing project");
  const project = await prisma.project.findFirst({
    where: { OR: [{ name: { equals: projectName, mode: "insensitive" } }, { siteId: { equals: projectName, mode: "insensitive" } }] }
  });
  if (!project) throw new Error(`Project not found: ${projectName}`);
  return project;
}

async function importProjectRow(row: Record<string, string>) {
  const name = required(row, "name");
  const siteId = required(row, "siteId");
  await prisma.project.upsert({
    where: { id: `import-${normalize(siteId).replace(/\s/g, "-")}` },
    update: {},
    create: {
      id: `import-${normalize(siteId).replace(/\s/g, "-")}`,
      name,
      siteId,
      client: pickEnum(row.client, enumMaps.client, "OTHER") as never,
      workType: pickEnum(row.workType, enumMaps.workType, "INSTALLATION") as never,
      technology: pickEnum(row.technology, enumMaps.technology, "FOUR_G") as never,
      region: row.region || "Imported",
      startDate: optionalDate(row, "startDate") ?? new Date(),
      endDate: optionalDate(row, "endDate"),
      status: pickEnum(row.status, enumMaps.projectStatus, "PLANNED") as never,
      contractValue: optionalNumber(row, "contractValue"),
      allocatedBudget: optionalNumber(row, "allocatedBudget"),
      priority: optionalNumber(row, "priority", 2),
      complexity: optionalNumber(row, "complexity", 2)
    }
  });
}

async function importEmployeeRow(row: Record<string, string>) {
  await prisma.employee.create({
    data: {
      fullName: required(row, "fullName"),
      phone: row.phone,
      role: pickEnum(row.role, enumMaps.role, "TECHNICIAN") as never,
      baseSalary: optionalNumber(row, "baseSalary"),
      allowanceRate: pickEnum(row.allowanceRate, enumMaps.allowanceRate, "MAD_160") as never
    }
  });
}

async function importVehicleRow(row: Record<string, string>) {
  const project = row.projectName ? await findProject(row).catch(() => null) : null;
  await prisma.vehicle.upsert({
    where: { plate: required(row, "plate").toUpperCase() },
    update: {
      model: required(row, "model"),
      projectId: project?.id ?? null,
      mileage: optionalNumber(row, "mileage"),
      fuelUsage: optionalNumber(row, "fuelUsage"),
      googleMapsLink: row.googleMapsLink || null,
      locationType: pickEnum(row.locationType, enumMaps.locationType, "MANUAL") as never,
      oilChangeDue: optionalDate(row, "oilChangeDue"),
      insuranceDue: optionalDate(row, "insuranceDue"),
      inspectionDue: optionalDate(row, "inspectionDue")
    },
    create: {
      plate: required(row, "plate").toUpperCase(),
      model: required(row, "model"),
      projectId: project?.id ?? null,
      mileage: optionalNumber(row, "mileage"),
      fuelUsage: optionalNumber(row, "fuelUsage"),
      googleMapsLink: row.googleMapsLink || null,
      locationType: pickEnum(row.locationType, enumMaps.locationType, "MANUAL") as never,
      oilChangeDue: optionalDate(row, "oilChangeDue"),
      insuranceDue: optionalDate(row, "insuranceDue"),
      inspectionDue: optionalDate(row, "inspectionDue")
    }
  });
}

async function importPurchaseRow(row: Record<string, string>, userId: string) {
  const project = await findProject(row);
  await prisma.purchase.create({
    data: {
      projectId: project.id,
      submittedById: userId,
      item: required(row, "item"),
      category: required(row, "category"),
      amount: optionalNumber(row, "amount"),
      paymentMethod: pickEnum(row.paymentMethod, enumMaps.paymentMethod, "CASH") as never,
      notes: row.notes,
      status: pickEnum(row.status, enumMaps.approvalStatus, "PENDING") as never
    }
  });
  await recalculateProjectCost(project.id);
}

async function importExpenseRow(row: Record<string, string>, userId: string) {
  const project = await findProject(row);
  const category = required(row, "category");
  const adminOverride = ["true", "yes", "oui", "1"].includes(normalize(row.adminOverride || ""));
  if (isForbiddenFieldExpense(category, adminOverride)) throw new Error("Food/hotel/personal requires admin override");
  await prisma.expense.create({
    data: {
      projectId: project.id,
      submittedById: userId,
      category,
      amount: optionalNumber(row, "amount"),
      adminOverride,
      notes: row.notes,
      status: pickEnum(row.status, enumMaps.approvalStatus, "PENDING") as never
    }
  });
  await recalculateProjectCost(project.id);
}

export async function updateLocation(formData: FormData) {
  const user = await currentUser();
  const location = await prisma.locationUpdate.create({
    data: {
      userId: user.id,
      missionId: text(formData, "missionId") || null,
      note: text(formData, "note"),
      googleMapsLink: text(formData, "googleMapsLink") || null,
      latitude: text(formData, "latitude") ? number(formData, "latitude") : null,
      longitude: text(formData, "longitude") ? number(formData, "longitude") : null,
      locationType: text(formData, "locationType") as never
    }
  });
  await audit({ actorId: user.id, action: "UPDATE_LOCATION", entity: "LocationUpdate", entityId: location.id, after: location });
  revalidatePath("/technician");
}

export async function approveSubmission(formData: FormData) {
  const user = await currentUser();
  if (!canApprove(user.role)) throw new Error("Not allowed");
  const entity = text(formData, "entity") as "purchase" | "expense" | "advance";
  const id = text(formData, "id");
  const status = text(formData, "status") as ApprovalStatus;
  const approvedAmount = text(formData, "approvedAmount") ? number(formData, "approvedAmount") : null;
  const reason = text(formData, "reason");
  if (status === "REJECTED" && !reason) throw new Error("Rejection reason is required.");
  if (status === "PARTIALLY_APPROVED" && approvedAmount === null) throw new Error("Partial approval requires an approved amount.");

  if (entity === "purchase") {
    const before = await prisma.purchase.findUniqueOrThrow({ where: { id } });
    if (!(await canAccessProject(user, before.projectId))) throw new Error("Not allowed for this project.");
    if (user.role === "BOSS" && status !== "PENDING" && !reason) throw new Error("Boss override requires a logged reason.");
    const updated = await prisma.purchase.update({ where: { id }, data: { status, approvedAmount } });
    await prisma.approval.create({ data: { actorId: user.id, purchaseId: id, status, approvedAmount, reason } });
    await recalculateProjectCost(updated.projectId);
    await audit({ actorId: user.id, action: "APPROVE", entity: "Purchase", entityId: id, before, after: updated });
  }
  if (entity === "expense") {
    const before = await prisma.expense.findUniqueOrThrow({ where: { id } });
    if (!(await canAccessProject(user, before.projectId))) throw new Error("Not allowed for this project.");
    if (user.role === "BOSS" && status !== "PENDING" && !reason) throw new Error("Boss override requires a logged reason.");
    const updated = await prisma.expense.update({ where: { id }, data: { status, approvedAmount } });
    await prisma.approval.create({ data: { actorId: user.id, expenseId: id, status, approvedAmount, reason } });
    await recalculateProjectCost(updated.projectId);
    await audit({ actorId: user.id, action: "APPROVE", entity: "Expense", entityId: id, before, after: updated });
  }
  if (entity === "advance") {
    const before = await prisma.advanceRequest.findUniqueOrThrow({ where: { id } });
    if (!(await canAccessProject(user, before.projectId))) throw new Error("Not allowed for this project.");
    if (user.role === "BOSS" && status !== "PENDING" && !reason) throw new Error("Boss override requires a logged reason.");
    const updated = await prisma.advanceRequest.update({ where: { id }, data: { status } });
    await prisma.approval.create({ data: { actorId: user.id, advanceId: id, status, approvedAmount, reason } });
    await audit({ actorId: user.id, action: "APPROVE", entity: "AdvanceRequest", entityId: id, before, after: updated });
  }
  revalidatePath("/");
}

export async function createCashMovement(formData: FormData) {
  const user = await currentUser();
  const accountId = text(formData, "accountId");
  const type = text(formData, "type") as "INCOMING" | "OUTGOING";
  const amount = number(formData, "amount");
  const projectId = text(formData, "projectId") || null;
  const account = await prisma.cashAccount.findUniqueOrThrow({ where: { id: accountId } });
  if (type === "OUTGOING" && Number(account.balance) < amount && !canOverride(user.role)) throw new Error("Cash payment blocked: insufficient account balance.");
  if (type === "OUTGOING" && projectId) {
    const check = await canSpendProject(projectId, amount, user.role);
    if (!check.ok) throw new Error("Payment blocked: project budget or company cash is not available.");
  }
  const movement = await prisma.cashMovement.create({
    data: { accountId, type, amount, description: text(formData, "description"), projectId, createdById: user.id }
  });
  await prisma.cashAccount.update({
    where: { id: accountId },
    data: { balance: type === "INCOMING" ? Number(account.balance) + amount : Number(account.balance) - amount }
  });
  await audit({ actorId: user.id, action: "CREATE", entity: "CashMovement", entityId: movement.id, after: movement });
  revalidatePath("/cash");
}

export async function createInvite(formData: FormData) {
  const user = await currentUser();
  if (!["BOSS", "GENERAL_MANAGER", "SUPER_ADMIN", "ADMIN"].includes(user.role)) throw new Error("Not allowed");
  const token = createInviteToken();
  const role = text(formData, "role") as Role;
  const projectIds = formData.getAll("projectIds").map(String).filter(Boolean);
  if (role === "PROJECT_MANAGER" && projectIds.length === 0) throw new Error("Project Manager invites require assigned projects.");
  const invite = await prisma.invite.create({
    data: {
      email: text(formData, "email").toLowerCase(),
      role,
      expiresAt: new Date(text(formData, "expiresAt")),
      tokenHash: hashToken(token),
      createdById: user.id,
      projects: { create: projectIds.map((projectId) => ({ projectId })) }
    }
  });
  await audit({ actorId: user.id, action: "CREATE", entity: "Invite", entityId: invite.id, after: { email: invite.email, role: invite.role, projectIds } });
  revalidatePath("/settings");
  return `/invite/${token}`;
}

export async function acceptInvite(token: string, formData: FormData) {
  const tokenHash = hashToken(token);
  const invite = await prisma.invite.findUnique({ where: { tokenHash } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    await prisma.inviteUsageLog.create({ data: { inviteId: invite?.id ?? "invalid", success: false, reason: "Invalid or expired invite" } }).catch(() => undefined);
    throw new Error("Invalid or expired invite.");
  }
  const submittedEmail = text(formData, "email").toLowerCase();
  if (submittedEmail !== invite.email.toLowerCase()) {
    await prisma.inviteUsageLog.create({ data: { inviteId: invite.id, email: submittedEmail, success: false, reason: "Email does not match invite" } });
    throw new Error("This invite can only be used by the invited email address.");
  }
  const passwordHash = await bcrypt.hash(text(formData, "password"), 12);
  const projectLinks = await prisma.inviteProjectAssignment.findMany({ where: { inviteId: invite.id } });
  const user = await prisma.user.create({
    data: {
      email: invite.email,
      name: text(formData, "name"),
      role: invite.role,
      passwordHash,
      projectAssignments: { create: projectLinks.map((link) => ({ projectId: link.projectId })) }
    }
  });
  await prisma.invite.update({ where: { id: invite.id }, data: { usedAt: new Date(), usedById: user.id } });
  await prisma.inviteUsageLog.create({ data: { inviteId: invite.id, email: invite.email, success: true } });
  await audit({ actorId: user.id, action: "ACCEPT", entity: "Invite", entityId: invite.id, after: { userId: user.id } });
  redirect("/login");
}

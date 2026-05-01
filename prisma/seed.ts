import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";

const demoPassword = "ChangeMe123!";

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function upsertUser(email: string, name: string, role: Role, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    update: { name, role, active: true, passwordHash },
    create: { email, name, role, active: true, passwordHash }
  });
}

async function upsertEmployeeForUser(input: {
  id: string;
  userId: string;
  fullName: string;
  role: Role;
  baseSalary: number;
  allowanceRate: "MAD_152" | "MAD_160" | "MAD_175";
}) {
  const existing = await prisma.employee.findUnique({ where: { userId: input.userId } });
  if (existing) {
    return prisma.employee.update({
      where: { id: existing.id },
      data: {
        fullName: input.fullName,
        role: input.role,
        baseSalary: input.baseSalary,
        allowanceRate: input.allowanceRate,
        active: true
      }
    });
  }

  return prisma.employee.upsert({
    where: { id: input.id },
    update: {
      userId: input.userId,
      fullName: input.fullName,
      role: input.role,
      baseSalary: input.baseSalary,
      allowanceRate: input.allowanceRate,
      active: true
    },
    create: {
      id: input.id,
      userId: input.userId,
      fullName: input.fullName,
      role: input.role,
      baseSalary: input.baseSalary,
      allowanceRate: input.allowanceRate
    }
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const configuredBossEmail = (process.env.BOSS_EMAIL ?? "boss@telecom.local").toLowerCase();

  const users = {
    boss: await upsertUser(configuredBossEmail, "Boss", "BOSS", passwordHash),
    generalManager: await upsertUser("gm@scadacom.local", "General Manager", "GENERAL_MANAGER", passwordHash),
    pm1: await upsertUser("pm1@scadacom.local", "Project Manager Rabat", "PROJECT_MANAGER", passwordHash),
    pm2: await upsertUser("pm2@scadacom.local", "Project Manager Casablanca", "PROJECT_MANAGER", passwordHash),
    pm3: await upsertUser("pm3@scadacom.local", "Project Manager North", "PROJECT_MANAGER", passwordHash),
    finance1: await upsertUser("finance1@scadacom.local", "Finance Controller", "FINANCIAL_DEPARTMENT", passwordHash),
    finance2: await upsertUser("finance2@scadacom.local", "Cost Manager", "FINANCIAL_DEPARTMENT", passwordHash),
    leader: await upsertUser("leader@scadacom.local", "Team Leader", "TEAM_LEADER", passwordHash),
    tech: await upsertUser("tech@scadacom.local", "Technician", "TECHNICIAN", passwordHash),
    warehouse: await upsertUser("warehouse@scadacom.local", "Warehouse Manager", "WAREHOUSE_MANAGER", passwordHash),
    fleet: await upsertUser("fleet@scadacom.local", "Fleet Manager", "FLEET_MANAGER", passwordHash)
  };

  const bossPasscodeHash =
    process.env.BOSS_ROOM_PASSCODE_HASH && process.env.BOSS_ROOM_PASSCODE_HASH.trim().length > 0
      ? process.env.BOSS_ROOM_PASSCODE_HASH
      : await bcrypt.hash("0000", 12);

  await prisma.bossRoomCredential.upsert({
    where: { id: "boss-room" },
    update: { passcodeHash: bossPasscodeHash, updatedById: users.boss.id },
    create: { id: "boss-room", passcodeHash: bossPasscodeHash, updatedById: users.boss.id }
  });

  const leader = await upsertEmployeeForUser({
    id: "employee-leader-1",
    userId: users.leader.id,
    fullName: "Team Leader",
    role: "TEAM_LEADER",
    baseSalary: 6500,
    allowanceRate: "MAD_175"
  });

  const technician = await upsertEmployeeForUser({
    id: "employee-tech-1",
    userId: users.tech.id,
    fullName: "Technician",
    role: "TECHNICIAN",
    baseSalary: 4500,
    allowanceRate: "MAD_160"
  });

  const projects = [
    {
      id: "project-rabat-5g",
      name: "Rabat 5G Upgrade",
      client: "MAROC_TELECOM" as const,
      workType: "UPGRADE" as const,
      technology: "FIVE_G" as const,
      region: "Rabat-Sale-Kenitra",
      siteId: "RBT-5G-001",
      contractValue: 280000,
      allocatedBudget: 180000,
      pmId: users.pm1.id
    },
    {
      id: "project-casa-fiber",
      name: "Casablanca Fiber Rollout",
      client: "INWI" as const,
      workType: "FIBER" as const,
      technology: "FIBER" as const,
      region: "Casablanca-Settat",
      siteId: "CAS-FBR-014",
      contractValue: 360000,
      allocatedBudget: 220000,
      pmId: users.pm2.id
    },
    {
      id: "project-tangier-power",
      name: "Tangier Power Maintenance",
      client: "ERICSSON" as const,
      workType: "MAINTENANCE" as const,
      technology: "POWER" as const,
      region: "Tanger-Tetouan-Al Hoceima",
      siteId: "TNG-PWR-008",
      contractValue: 145000,
      allocatedBudget: 90000,
      pmId: users.pm3.id
    }
  ];

  for (const project of projects) {
    await prisma.project.upsert({
      where: { id: project.id },
      update: {
        name: project.name,
        client: project.client,
        workType: project.workType,
        technology: project.technology,
        region: project.region,
        siteId: project.siteId,
        status: "ACTIVE",
        contractValue: project.contractValue,
        allocatedBudget: project.allocatedBudget
      },
      create: {
        id: project.id,
        name: project.name,
        client: project.client,
        workType: project.workType,
        technology: project.technology,
        region: project.region,
        siteId: project.siteId,
        startDate: daysFromNow(-20),
        status: "ACTIVE",
        contractValue: project.contractValue,
        allocatedBudget: project.allocatedBudget,
        priority: 4,
        complexity: 3
      }
    });
    await prisma.projectAssignment.upsert({
      where: { userId_projectId: { userId: project.pmId, projectId: project.id } },
      update: {},
      create: { userId: project.pmId, projectId: project.id }
    });
  }

  await prisma.team.upsert({
    where: { id: "team-rabat" },
    update: { name: "Rabat Field Team", leaderId: leader.id },
    create: { id: "team-rabat", name: "Rabat Field Team", leaderId: leader.id }
  });
  await prisma.team.upsert({
    where: { id: "team-casa" },
    update: { name: "Casablanca Fiber Team", leaderId: leader.id },
    create: { id: "team-casa", name: "Casablanca Fiber Team", leaderId: leader.id }
  });
  await prisma.teamMember.createMany({
    data: [
      { teamId: "team-rabat", employeeId: leader.id },
      { teamId: "team-rabat", employeeId: technician.id },
      { teamId: "team-casa", employeeId: leader.id },
      { teamId: "team-casa", employeeId: technician.id }
    ],
    skipDuplicates: true
  });

  await prisma.vehicle.upsert({
    where: { plate: "A-12345" },
    update: {
      model: "Renault Kangoo",
      driverId: leader.id,
      projectId: "project-rabat-5g",
      mileage: 118500,
      fuelUsage: 8.2,
      oilChangeDue: daysFromNow(7),
      insuranceDue: daysFromNow(25),
      inspectionDue: daysFromNow(45)
    },
    create: {
      id: "vehicle-kangoo-1",
      plate: "A-12345",
      model: "Renault Kangoo",
      driverId: leader.id,
      projectId: "project-rabat-5g",
      mileage: 118500,
      fuelUsage: 8.2,
      googleMapsLink: "https://maps.google.com/?q=Rabat",
      oilChangeDue: daysFromNow(7),
      insuranceDue: daysFromNow(25),
      inspectionDue: daysFromNow(45)
    }
  });

  const missions = [
    { id: "mission-rabat-1", projectId: "project-rabat-5g", teamId: "team-rabat", vehicleId: "vehicle-kangoo-1", title: "Rabat sector 5G commissioning", location: "Rabat", days: 4 },
    { id: "mission-casa-1", projectId: "project-casa-fiber", teamId: "team-casa", vehicleId: null, title: "Casablanca fiber site survey", location: "Casablanca", days: 3 },
    { id: "mission-tangier-1", projectId: "project-tangier-power", teamId: "team-rabat", vehicleId: null, title: "Tangier power maintenance", location: "Tangier", days: 2 }
  ];

  for (const mission of missions) {
    await prisma.mission.upsert({
      where: { id: mission.id },
      update: {
        title: mission.title,
        location: mission.location,
        days: mission.days,
        teamLocked: true,
        status: "ACTIVE",
        vehicleId: mission.vehicleId
      },
      create: {
        id: mission.id,
        projectId: mission.projectId,
        teamId: mission.teamId,
        vehicleId: mission.vehicleId,
        title: mission.title,
        location: mission.location,
        startDate: daysFromNow(-mission.days),
        endDate: null,
        days: mission.days,
        teamLocked: true,
        status: "ACTIVE"
      }
    });
    await prisma.missionTechnician.createMany({
      data: [
        { missionId: mission.id, employeeId: leader.id, locked: true },
        { missionId: mission.id, employeeId: technician.id, locked: true }
      ],
      skipDuplicates: true
    });
  }

  await prisma.deploymentAllowance.createMany({
    data: [
      { id: "allowance-rabat-leader", missionId: "mission-rabat-1", employeeId: leader.id, days: 4, rateMad: 175, totalMad: 700 },
      { id: "allowance-rabat-tech", missionId: "mission-rabat-1", employeeId: technician.id, days: 4, rateMad: 160, totalMad: 640 },
      { id: "allowance-casa-leader", missionId: "mission-casa-1", employeeId: leader.id, days: 3, rateMad: 175, totalMad: 525 },
      { id: "allowance-casa-tech", missionId: "mission-casa-1", employeeId: technician.id, days: 3, rateMad: 160, totalMad: 480 }
    ],
    skipDuplicates: true
  });

  await prisma.purchase.upsert({
    where: { id: "purchase-fuel-rabat" },
    update: { status: "APPROVED", approvedAmount: 620 },
    create: {
      id: "purchase-fuel-rabat",
      projectId: "project-rabat-5g",
      missionId: "mission-rabat-1",
      submittedById: users.leader.id,
      item: "Diesel fuel",
      category: "Fuel",
      amount: 620,
      approvedAmount: 620,
      paymentMethod: "CASH",
      notes: "Approved demo fuel purchase",
      status: "APPROVED"
    }
  });
  await prisma.purchase.upsert({
    where: { id: "purchase-connectors-casa" },
    update: { status: "PENDING", approvedAmount: null },
    create: {
      id: "purchase-connectors-casa",
      projectId: "project-casa-fiber",
      missionId: "mission-casa-1",
      submittedById: users.tech.id,
      item: "Fiber connectors",
      category: "Materials",
      amount: 1450,
      paymentMethod: "ADVANCE",
      notes: "Pending verification demo purchase",
      status: "PENDING"
    }
  });
  await prisma.expense.upsert({
    where: { id: "expense-peage-rabat" },
    update: { status: "APPROVED", approvedAmount: 85 },
    create: {
      id: "expense-peage-rabat",
      projectId: "project-rabat-5g",
      missionId: "mission-rabat-1",
      submittedById: users.leader.id,
      category: "Peage",
      amount: 85,
      approvedAmount: 85,
      notes: "Approved demo toll expense",
      status: "APPROVED"
    }
  });
  await prisma.expense.upsert({
    where: { id: "expense-tools-tangier" },
    update: { status: "PENDING", approvedAmount: null },
    create: {
      id: "expense-tools-tangier",
      projectId: "project-tangier-power",
      missionId: "mission-tangier-1",
      submittedById: users.tech.id,
      category: "Tools",
      amount: 340,
      notes: "Pending demo tool expense",
      status: "PENDING"
    }
  });

  await prisma.advanceRequest.upsert({
    where: { id: "advance-rabat-fuel" },
    update: { status: "PENDING" },
    create: {
      id: "advance-rabat-fuel",
      projectId: "project-rabat-5g",
      missionId: "mission-rabat-1",
      requestedById: users.leader.id,
      category: "Fuel",
      amount: 1500,
      reason: "Fuel and tolls for current mission",
      status: "PENDING"
    }
  });

  await prisma.cashAccount.upsert({
    where: { id: "cash-box" },
    update: { balance: 50000 },
    create: { id: "cash-box", name: "Main Cash Box", type: "CASH_BOX", balance: 50000 }
  });
  await prisma.cashAccount.upsert({
    where: { id: "bank-main" },
    update: { balance: 150000 },
    create: { id: "bank-main", name: "Main Bank", type: "BANK", balance: 150000 }
  });

  await prisma.supplier.upsert({
    where: { id: "supplier-fiberplus" },
    update: { name: "FiberPlus Morocco", phone: "+212600000001", email: "billing@fiberplus.ma" },
    create: { id: "supplier-fiberplus", name: "FiberPlus Morocco", phone: "+212600000001", email: "billing@fiberplus.ma", address: "Casablanca" }
  });
  await prisma.supplierInvoice.upsert({
    where: { id: "supplier-invoice-001" },
    update: { amount: 18000, paidAmount: 5000, dueDate: daysFromNow(-5) },
    create: {
      id: "supplier-invoice-001",
      supplierId: "supplier-fiberplus",
      number: "BC-TEST-001",
      amount: 18000,
      paidAmount: 5000,
      dueDate: daysFromNow(-5)
    }
  });

  await prisma.taxObligation.upsert({
    where: { id: "tax-tva-2026-04" },
    update: { amountDue: 18000, paid: 0, dueDate: daysFromNow(12), status: "UPCOMING" },
    create: { id: "tax-tva-2026-04", type: "TVA", period: "2026-04", amountDue: 18000, paid: 0, dueDate: daysFromNow(12), status: "UPCOMING" }
  });
  await prisma.taxObligation.upsert({
    where: { id: "tax-cnss-2026-04" },
    update: { amountDue: 9000, paid: 2000, dueDate: daysFromNow(-2), status: "OVERDUE" },
    create: { id: "tax-cnss-2026-04", type: "CNSS", period: "2026-04", amountDue: 9000, paid: 2000, dueDate: daysFromNow(-2), status: "OVERDUE" }
  });

  await prisma.inventoryItem.upsert({
    where: { sku: "CONN-SC-APC" },
    update: { name: "SC/APC Connectors", category: "Fiber", quantity: 3, lowStockAt: 10 },
    create: { id: "inventory-connectors", sku: "CONN-SC-APC", name: "SC/APC Connectors", category: "Fiber", quantity: 3, lowStockAt: 10 }
  });
  await prisma.stockMovement.createMany({
    data: [
      { id: "stock-connectors-in", itemId: "inventory-connectors", type: "INCOMING", quantity: 25, notes: "Opening stock" },
      { id: "stock-connectors-out", itemId: "inventory-connectors", projectId: "project-casa-fiber", type: "OUTGOING", quantity: 22, notes: "Issued to Casablanca mission" }
    ],
    skipDuplicates: true
  });

  await prisma.auditLog.create({
    data: {
      actorId: users.boss.id,
      action: "SEED",
      entity: "System",
      after: { users: Object.keys(users).length, projects: projects.length, deploymentReady: true }
    }
  });

  console.log("Seed complete.");
  console.log(`Demo password for all seed users: ${demoPassword}`);
  console.log("Boss Room passcode: 0000 unless BOSS_ROOM_PASSCODE_HASH was provided.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

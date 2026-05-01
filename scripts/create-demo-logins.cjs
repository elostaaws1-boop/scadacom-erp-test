const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const password = "ChangeMe123!";

async function upsertUser({ email, name, role }) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { name, role, active: true },
    create: { email, name, role, active: true, passwordHash }
  });
}

async function main() {
  const project = await prisma.project.findFirst({ orderBy: { createdAt: "asc" } });
  const users = {};

  users.boss = await upsertUser({ email: "boss@telecom.local", name: "Boss", role: "BOSS" });
  users.gm = await upsertUser({ email: "gm@scadacom.local", name: "General Manager", role: "GENERAL_MANAGER" });
  users.pm = await upsertUser({ email: "pm@scadacom.local", name: "Project Manager", role: "PROJECT_MANAGER" });
  users.finance = await upsertUser({ email: "finance@scadacom.local", name: "Financial Department", role: "FINANCIAL_DEPARTMENT" });
  users.leader = await upsertUser({ email: "leader@scadacom.local", name: "Team Leader", role: "TEAM_LEADER" });
  users.tech = await upsertUser({ email: "tech@scadacom.local", name: "Technician", role: "TECHNICIAN" });
  users.warehouse = await upsertUser({ email: "warehouse@scadacom.local", name: "Warehouse Manager", role: "WAREHOUSE_MANAGER" });
  users.fleet = await upsertUser({ email: "fleet@scadacom.local", name: "Fleet Manager", role: "FLEET_MANAGER" });

  if (project) {
    await prisma.projectAssignment.upsert({
      where: { userId_projectId: { userId: users.pm.id, projectId: project.id } },
      update: {},
      create: { userId: users.pm.id, projectId: project.id }
    });
  }

  await prisma.employee.upsert({
    where: { id: "leader-1" },
    update: { userId: users.leader.id, fullName: "Team Leader", role: "TEAM_LEADER" },
    create: { id: "leader-1", userId: users.leader.id, fullName: "Team Leader", role: "TEAM_LEADER", baseSalary: 6500, allowanceRate: "MAD_175" }
  });

  await prisma.employee.upsert({
    where: { id: "tech-1" },
    update: { userId: users.tech.id, fullName: "Technician", role: "TECHNICIAN" },
    create: { id: "tech-1", userId: users.tech.id, fullName: "Technician", role: "TECHNICIAN", baseSalary: 4500, allowanceRate: "MAD_160" }
  });

  await prisma.bossRoomCredential.upsert({
    where: { id: "boss-room" },
    update: {},
    create: {
      id: "boss-room",
      passcodeHash: await bcrypt.hash("0000", 12),
      updatedById: users.boss.id
    }
  });

  console.log("demo logins ready");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

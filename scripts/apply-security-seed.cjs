const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const boss = await prisma.user.update({
    where: { email: "boss@telecom.local" },
    data: { role: "BOSS" }
  });

  await prisma.bossRoomCredential.upsert({
    where: { id: "boss-room" },
    update: {},
    create: {
      id: "boss-room",
      passcodeHash: await bcrypt.hash("0000", 12),
      updatedById: boss.id
    }
  });
}

main()
  .then(() => console.log("strict RBAC security seed ok"))
  .finally(() => prisma.$disconnect());

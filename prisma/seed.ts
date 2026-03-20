import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaLibSql({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@sentinel.ai" },
    update: {},
    create: { name: "Admin", email: "admin@sentinel.ai", password: adminPassword, role: "ADMIN" },
  });

  const userPassword = await bcrypt.hash("user123", 10);
  await prisma.user.upsert({
    where: { email: "user@sentinel.ai" },
    update: {},
    create: { name: "Test User", email: "user@sentinel.ai", password: userPassword, role: "USER" },
  });

  console.log("✅ Seed complete - Users created");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
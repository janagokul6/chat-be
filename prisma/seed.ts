import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const users = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Ada" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Bea" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Cam" },
];

async function seed() {
  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { name: user.name },
      create: user,
    });
  }
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

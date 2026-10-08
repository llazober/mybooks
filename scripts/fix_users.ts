import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('12345', 10);
  
  // 1. Fix Admin
  const admin = await prisma.user.upsert({
    where: { email: 'luislazober@gmail.com' },
    update: {
      password: passwordHash,
      role: 'ADMIN',
      requiresPasswordChange: false,
    },
    create: {
      email: 'luislazober@gmail.com',
      password: passwordHash,
      role: 'ADMIN',
      requiresPasswordChange: false,
    },
  });
  console.log("Admin user created/updated:", admin.email);

  // Remove the old typo admin if it exists
  try {
    await prisma.user.delete({ where: { email: 'luislazober@gmail.co' } });
    console.log("Removed old typo admin account.");
  } catch (e) {
    // Ignore if not found
  }

  // 2. Setup user for Dalazo LLC
  let dalazoEntity = await prisma.entity.findFirst({
    where: { name: 'Dalazo LLC' }
  });

  if (!dalazoEntity) {
    console.log("Entity 'Dalazo LLC' not found. Creating it...");
    const beancountText = `option "title" "Dalazo LLC"\noption "operating_currency" "USD"\n\n`;
    dalazoEntity = await prisma.entity.create({
      data: {
        id: 'dalazo-llc',
        name: 'Dalazo LLC',
        beancount: beancountText,
      }
    });
  }

  const dalazoUser = await prisma.user.upsert({
    where: { email: 'luislazo@datalazo.net' },
    update: {
      password: passwordHash,
      role: 'COMPANY',
      entityId: dalazoEntity.id,
      requiresPasswordChange: true,
    },
    create: {
      email: 'luislazo@datalazo.net',
      password: passwordHash,
      role: 'COMPANY',
      entityId: dalazoEntity.id,
      requiresPasswordChange: true,
    },
  });
  console.log("Company user linked to Dalazo LLC:", dalazoUser.email);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

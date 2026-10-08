import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('12345', 10);
  
  const admin1 = await prisma.user.upsert({
    where: { email: 'luislazober@gmail.com' },
    update: {},
    create: {
      email: 'luislazober@gmail.com',
      password: passwordHash,
      role: 'ADMIN',
      requiresPasswordChange: false,
    },
  });

  const admin2 = await prisma.user.upsert({
    where: { email: 'luislazo@datalazo.net' },
    update: {},
    create: {
      email: 'luislazo@datalazo.net',
      password: passwordHash,
      role: 'ADMIN',
      requiresPasswordChange: false,
    },
  });

  const admin3PasswordHash = await bcrypt.hash('hon12345', 10);
  const admin3 = await prisma.user.upsert({
    where: { email: 'vrtservices12@gmail.com' },
    update: {},
    create: {
      email: 'vrtservices12@gmail.com',
      password: admin3PasswordHash,
      role: 'ADMIN',
      requiresPasswordChange: false,
    },
  });

  console.log("Admin users created/verified:", admin1.email, admin2.email, admin3.email);
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

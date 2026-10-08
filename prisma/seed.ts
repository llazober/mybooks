import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('12345', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'luislazober@gmail.co' },
    update: {},
    create: {
      email: 'luislazober@gmail.co',
      password: passwordHash,
      role: 'ADMIN',
      requiresPasswordChange: false,
    },
  });

  console.log("Admin user created/verified:", admin.email);
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

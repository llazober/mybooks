import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function main() {
  const prisma = new PrismaClient();
  const email = 'luislazo@datalazo.net';
  const newPassword = '12345'; // Setting back to default
  
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    console.error(`User ${email} not found in database!`);
    process.exit(1);
  }
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  await prisma.user.update({
    where: { email },
    data: {
      password: hashedPassword,
      requiresPasswordChange: true // forces them to set a new one on next login
    }
  });
  
  console.log(`Successfully reset password for ${email} to '${newPassword}'`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  });

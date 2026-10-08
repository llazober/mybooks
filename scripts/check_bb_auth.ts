import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const entity = await prisma.entity.findUnique({ where: { id: 'datalazo-llc' } });
  
  if (entity) {
    const lines = entity.beancount.split('\n');
    const authLines = lines.filter(l => l.includes('bb_owner') || l.includes('bb_pwhash'));
    console.log("Auth lines found:", authLines);
  }
}
main().catch(console.error);

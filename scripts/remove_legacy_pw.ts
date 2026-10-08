import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const entity = await prisma.entity.findUnique({ where: { id: 'datalazo-llc' } });
  
  if (entity) {
    const lines = entity.beancount.split('\n');
    const newLines = lines.filter(l => !l.includes('bb_owner') && !l.includes('bb_pwhash'));
    
    await prisma.entity.update({
      where: { id: 'datalazo-llc' },
      data: { beancount: newLines.join('\n') }
    });
    
    console.log("Successfully removed legacy file-level password from Datalazo LLC!");
  }
}

main().catch(console.error);

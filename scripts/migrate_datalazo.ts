import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const localClient = new Client({
    connectionString: "postgresql://postgres:Paris2025$@localhost:5432/plaingl?schema=public",
  });
  
  await localClient.connect();
  const res = await localClient.query("SELECT * FROM \"Entity\" WHERE id = 'datalazo-llc'");
  const data = res.rows[0];
  console.log("Found in plaingl DB! Size:", data.beancount.length);
  
  const prisma = new PrismaClient();
  
  // 1. Create or update datalazo-llc in cloud
  const newEntity = await prisma.entity.upsert({
    where: { id: 'datalazo-llc' },
    update: { beancount: data.beancount, name: 'Datalazo LLC' },
    create: {
      id: 'datalazo-llc',
      name: 'Datalazo LLC',
      beancount: data.beancount,
    }
  });
  
  console.log("Successfully migrated Datalazo LLC data to cloud!");
  
  // 2. Update user to point to datalazo-llc
  const user = await prisma.user.update({
    where: { email: 'luislazo@datalazo.net' },
    data: { entityId: 'datalazo-llc' }
  });
  console.log("Updated user entity mapping to datalazo-llc");
  
  // 3. Delete empty dalazo-llc
  try {
    await prisma.entity.delete({ where: { id: 'dalazo-llc' }});
    console.log("Deleted typo entity dalazo-llc");
  } catch (e) {
    // ignore
  }

  await localClient.end();
}

main().catch(console.error);

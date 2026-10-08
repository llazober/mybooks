import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const localClient = new Client({
    connectionString: "postgresql://postgres:Paris2025$@localhost:5432/plaingl?schema=public",
  });
  
  await localClient.connect();
  const res = await localClient.query("SELECT * FROM \"Entity\" WHERE id = 'dalazo-llc' OR name = 'Dalazo LLC'");
  
  if (res.rows.length === 0) {
    console.log("Not found in plaingl DB");
  } else {
    const data = res.rows[0];
    console.log("Found in plaingl DB! Size:", data.beancount.length);
    
    // Push to cloud DB
    const prisma = new PrismaClient(); // connects to cloud because of .env
    await prisma.entity.update({
      where: { id: data.id },
      data: { beancount: data.beancount }
    });
    console.log("Successfully migrated Dalazo LLC data to cloud!");
  }
  
  await localClient.end();
}

main().catch(console.error);

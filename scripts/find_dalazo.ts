import { Client } from 'pg';

async function main() {
  const rootClient = new Client({
    connectionString: "postgresql://postgres:Paris2025$@localhost:5432/postgres?schema=public",
  });
  
  await rootClient.connect();
  const res = await rootClient.query("SELECT datname FROM pg_database WHERE datistemplate = false;");
  
  const dbs = res.rows.map(r => r.datname);
  console.log("Found DBs locally:", dbs);
  
  for (const db of dbs) {
    if (db === 'postgres' || db.startsWith('pg_')) continue;
    try {
      const dbClient = new Client({
        connectionString: `postgresql://postgres:Paris2025$@localhost:5432/${db}?schema=public`,
      });
      await dbClient.connect();
      const entityRes = await dbClient.query("SELECT * FROM \"Entity\" WHERE name = 'Dalazo LLC'");
      if (entityRes.rows.length > 0) {
        console.log(`FOUND Dalazo LLC in database: ${db}, length: ${entityRes.rows[0].beancount.length}`);
      }
      await dbClient.end();
    } catch (e) {
      // ignore
    }
  }
  
  await rootClient.end();
}

main().catch(console.error);

import { Client } from 'pg';

async function main() {
  const dbClient = new Client({
    connectionString: "postgresql://postgres:Paris2025$@localhost:5432/plaingl?schema=public",
  });
  await dbClient.connect();
  const res = await dbClient.query("SELECT * FROM \"User\"");
  console.log("Users in local plaingl:", res.rows.map(r => r.email));
  await dbClient.end();
}

main().catch(console.error);

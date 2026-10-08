import { Client } from 'pg';

async function main() {
  const dbClient = new Client({
    connectionString: "postgresql://postgres:Paris2025$@localhost:5432/plaingl?schema=public",
  });
  await dbClient.connect();
  const res = await dbClient.query("SELECT id, name, length(beancount) as len, beancount FROM \"Entity\"");
  for (const row of res.rows) {
    console.log(`Local Booking DB - Entity: ${row.name} (${row.id}), Length: ${row.len}`);
    if (row.id === 'dalazo-llc') {
      console.log("Snippet:", row.beancount.substring(0, 200));
    }
  }
  await dbClient.end();
}

main().catch(console.error);

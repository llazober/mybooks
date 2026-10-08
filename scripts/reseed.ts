import { reseedSample } from '../app/actions';

async function main() {
  console.log("Reseeding sample data...");
  const result = await reseedSample();
  console.log("Result:", result);
}

main().catch(console.error);

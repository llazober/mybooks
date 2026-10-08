import { prisma } from "../lib/store/pg";
import { parse, serialize } from "../lib/beancount";

async function clearTransactions() {
  const entityId = "datalazo-llc";
  
  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  if (!entity) {
    console.error("Entity not found:", entityId);
    return;
  }
  
  const { ledger } = parse(entity.beancount);
  
  // Keep everything except transactions
  ledger.directives = ledger.directives.filter(d => d.kind !== "transaction");
  
  const newBeancount = serialize(ledger);
  
  await prisma.entity.update({
    where: { id: entityId },
    data: {
      beancount: newBeancount,
    },
  });
  
  console.log("All transactions cleared for", entityId);
}

clearTransactions().catch(console.error);

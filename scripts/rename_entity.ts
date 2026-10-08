import { prisma } from "../lib/store/pg";

async function renameEntity() {
  const oldId = "toiraks-group-homes-inc";
  const newId = "datalazo-llc";
  const newName = "Datalazo LLC";

  const entity = await prisma.entity.findUnique({ where: { id: oldId } });
  
  if (!entity) {
    console.error("Entity not found!");
    return;
  }

  // Replace the title inside the beancount file
  const newBeancount = entity.beancount.replace(
    /option "title" ".*?"/,
    `option "title" "${newName}"`
  );

  await prisma.entity.update({
    where: { id: oldId },
    data: {
      id: newId,
      name: newName,
      beancount: newBeancount,
    },
  });

  console.log("Entity renamed to", newName, "with new ID", newId);
}

renameEntity().catch(console.error);

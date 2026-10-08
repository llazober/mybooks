import { PrismaClient } from "@prisma/client";
import { LedgerStore, StoredEntity, ownerOf, SAMPLE_ID, SAMPLE_LEDGER } from "./types";

// Create a singleton PrismaClient instance
const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const pgStore: LedgerStore = {
  async listEntities() {
    await ensureSeedData();
    const entities = await prisma.entity.findMany({
      select: {
        id: true,
        name: true,
        owner: true,
        customerId: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return entities.map(e => ({
      id: e.id,
      name: e.name,
      owner: e.owner || "",
      customerId: e.customerId || undefined,
    }));
  },

  async loadEntity(id: string) {
    await ensureSeedData();
    const entity = await prisma.entity.findUnique({
      where: { id },
    });

    if (!entity) return null;

    return {
      id: entity.id,
      name: entity.name,
      beancount: entity.beancount,
    };
  },

  async saveEntity(id: string, beancount: string) {
    const owner = ownerOf(beancount);
    await prisma.entity.update({
      where: { id },
      data: {
        beancount,
        owner: owner || null,
      },
    });
  },

  async createEntity(id: string, name: string) {
    const beancount = "";
    const entity = await prisma.entity.create({
      data: {
        id,
        name,
        beancount,
        owner: null,
      },
    });

    return {
      id: entity.id,
      name: entity.name,
      beancount: entity.beancount,
    };
  },

  async deleteEntity(id: string) {
    if (id === SAMPLE_ID) return; // Don't delete sample data
    await prisma.entity.delete({
      where: { id },
    });
  },
};

async function ensureSeedData() {
  const existing = await prisma.entity.findUnique({
    where: { id: SAMPLE_ID },
  });
  if (!existing) {
    await prisma.entity.create({
      data: {
        id: SAMPLE_ID,
        name: "Sample Company",
        beancount: SAMPLE_LEDGER,
        owner: "",
      },
    });
  }
}

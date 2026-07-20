import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "@/app/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to initialize Prisma.");
}

type PrismaGlobal = typeof globalThis & {
  prisma?: PrismaClient;
};

const adapter = new PrismaPg(new Pool({ connectionString: databaseUrl }));

const globalForPrisma = globalThis as PrismaGlobal;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

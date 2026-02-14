import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  // Neon serverless driver uses WebSockets for low-latency queries in serverless envs.
  neonConfig.webSocketConstructor = ws;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // Don't fail module evaluation (e.g. during Next build); fail only when the DB is actually used.
    throw new Error(
      "DATABASE_URL is not set. Set it to your Neon Postgres connection string (or local Postgres) before using the DB.",
    );
  }

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export function getPrisma() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const prisma = createPrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
  return prisma;
}

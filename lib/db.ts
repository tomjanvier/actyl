/**
 * Prisma client singleton.
 *
 * Next.js hot-reloads modules in development, which would otherwise create a
 * new database connection pool on every reload until Postgres refuses
 * connections. Storing the client on `globalThis` avoids that classic pitfall.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

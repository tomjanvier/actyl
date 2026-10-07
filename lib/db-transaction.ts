import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaClient, type Prisma } from "../generated/prisma/client";
import { db } from "@/lib/db";

/** HTTP is kept for reads; interactive transactions need a request-scoped WebSocket. */
export async function withDbTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("neon.tech")) return db.$transaction(work);
  neonConfig.webSocketConstructor = globalThis.WebSocket;
  const client = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: url }),
  });
  try {
    return await client.$transaction(work, {
      maxWait: 10_000,
      timeout: 60_000,
    });
  } finally {
    await client.$disconnect();
  }
}

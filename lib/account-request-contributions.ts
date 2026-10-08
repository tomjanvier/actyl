import { Prisma } from "../generated/prisma/client";
import { db } from "@/lib/db";

/** JSON row access supports older AccountRequest tables without optional columns. */
export async function accountRequestContributions(
  ids: string[],
  client: Pick<Prisma.TransactionClient, "$queryRaw"> = db,
) {
  if (!ids.length) return new Map<string, { interest: string | null; amount: number | null }>();
  const rows = await client.$queryRaw<Array<{ id: string; interest: string | null; amount: number | null }>>(Prisma.sql`
    SELECT r.id,
      to_jsonb(r)->>'monthlyContributionInterest' AS interest,
      (to_jsonb(r)->>'monthlyContributionAmount')::integer AS amount
    FROM "AccountRequest" r WHERE r.id IN (${Prisma.join(ids)})
  `);
  return new Map(rows.map(row => [row.id, row]));
}

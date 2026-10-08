import type { Prisma } from "../generated/prisma/client";
import { db } from "@/lib/db";

import { parseCommissions } from "@/lib/commission-values";
export { parseCommissions } from "@/lib/commission-values";

/** Add source options while retaining the team's existing commission labels. */
export async function ensureCommissionField(
  workspaceId: string,
  names: string[],
  client: Pick<
    Prisma.TransactionClient,
    "customField" | "customFieldValue"
  > = db,
) {
  const existing = await client.customField.findUnique({
    where: { workspaceId_name: { workspaceId, name: "commission" } },
  });
  const options = [
    ...new Set([...parseCommissions(existing?.options), ...names]),
  ].sort((a, b) => a.localeCompare(b, "fr"));
  if (existing?.type === "SELECT") {
    const values = await client.customFieldValue.findMany({
      where: { fieldId: existing.id },
    });
    for (const value of values)
      await client.customFieldValue.update({
        where: { id: value.id },
        data: { value: JSON.stringify(parseCommissions(value.value)) },
      });
  }
  return client.customField.upsert({
    where: { workspaceId_name: { workspaceId, name: "commission" } },
    create: {
      workspaceId,
      name: "commission",
      label: "Commissions",
      type: "MULTI_SELECT",
      options: JSON.stringify(options),
      showInTable: true,
    },
    update: { type: "MULTI_SELECT", options: JSON.stringify(options) },
  });
}

/** Imports fill missing memberships; reviewed updates may replace them explicitly. */
export async function fillContactCommissions(
  workspaceId: string,
  people: Array<{ contactId: string; commissions?: string[] }>,
) {
  const withMemberships = people.filter((p) => p.commissions?.length);
  if (!withMemberships.length) return;
  const field = await ensureCommissionField(
    workspaceId,
    withMemberships.flatMap((p) => p.commissions ?? []),
  );
  const current = await db.customFieldValue.findMany({
    where: {
      fieldId: field.id,
      contactId: { in: withMemberships.map((p) => p.contactId) },
    },
    select: { id: true, contactId: true, value: true },
  });
  const populated = new Set(
    current
      .filter((v) => parseCommissions(v.value).length)
      .map((v) => v.contactId),
  );
  const existingByContact = new Map(current.map((v) => [v.contactId, v]));
  const pending = new Map(
    withMemberships
      .filter((p) => !populated.has(p.contactId))
      .map((p) => [p.contactId, p]),
  );
  const missing = [...pending.values()].filter(
    (p) => !existingByContact.has(p.contactId),
  );
  if (missing.length)
    await db.customFieldValue.createMany({
      data: missing.map((p) => ({
        fieldId: field.id,
        contactId: p.contactId,
        value: JSON.stringify(p.commissions),
      })),
      skipDuplicates: true,
    });
  for (const p of pending.values()) {
    const existing = existingByContact.get(p.contactId);
    if (!existing) continue;
    // A concurrent edit takes priority over filling an empty source value.
    await db.customFieldValue.updateMany({
      where: { id: existing.id, value: existing.value },
      data: { value: JSON.stringify(p.commissions) },
    });
  }
}

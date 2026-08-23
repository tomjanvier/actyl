import "server-only";
import { db } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Register (or refresh) a supporter in the unified people database.
 * Called from every public touchpoint — interpellation emails, petition
 * signatures and event RSVPs — so each engagement strengthens the relationship
 * instead of creating duplicates.
 *
 * Atomic upsert: safe under concurrent first-touch requests (no
 * find-then-create race). Tags accumulate instead of being overwritten.
 */
export async function upsertSupporter(input: {
  email: string;
  name: string;
  city?: string;
  workspaceId?: string;
  source?: string;
  tags?: string[];
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return;

  await db.supporter.upsert({
    where: { email },
    create: {
      email,
      name: input.name,
      city: input.city?.trim() || null,
      workspaceId: input.workspaceId ?? null,
      source: input.source ?? null,
      tags: input.tags?.length ? input.tags.join(",") : null,
    },
    update: {
      name: input.name || undefined,
      city: input.city?.trim() || undefined,
      workspaceId: input.workspaceId ?? undefined,
      source: input.source ?? undefined,
      touchCount: { increment: 1 },
      lastSeenAt: new Date(),
      ...(input.tags?.length
        ? {
            // Merge: keep existing manual/auto tags, add the new ones.
            tags: {
              set: [
                ...new Set(
                  [await currentTags(email), ...input.tags]
                    .flatMap((t) => t.split(","))
                    .map((t) => t.trim())
                    .filter(Boolean),
                ),
              ].join(","),
            },
          }
        : {}),
    },
  });
}

async function currentTags(email: string): Promise<string> {
  const row = await db.supporter.findUnique({
    where: { email },
    select: { tags: true },
  });
  return row?.tags ?? "";
}

/** Parse the comma-separated tag field into a clean list. */
export function parseTags(tags: string | null | undefined): string[] {
  return (tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

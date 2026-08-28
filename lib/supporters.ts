import "server-only";
import { db } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Enregistre ou actualise un soutien dans l'espace concerné. L'upsert atomique
 * évite les doublons concurrents et cumule les tags déjà présents.
 */
export async function upsertSupporter(input: {
  email: string;
  name: string;
  city?: string;
  workspaceId: string;
  source?: string;
  tags?: string[];
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return;

  await db.supporter.upsert({
    where: { workspaceId_email: { workspaceId: input.workspaceId, email } },
    create: {
      email,
      name: input.name,
      city: input.city?.trim() || null,
      workspaceId: input.workspaceId,
      source: input.source ?? null,
      tags: input.tags?.length ? input.tags.join(",") : null,
    },
    update: {
      name: input.name || undefined,
      city: input.city?.trim() || undefined,
      source: input.source ?? undefined,
      touchCount: { increment: 1 },
      lastSeenAt: new Date(),
      ...(input.tags?.length
        ? {
            // Conserve les tags existants et ajoute les nouveaux.
            tags: {
              set: [
                ...new Set(
                  [await currentTags(input.workspaceId, email), ...input.tags]
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

async function currentTags(workspaceId: string, email: string): Promise<string> {
  const row = await db.supporter.findUnique({
    where: { workspaceId_email: { workspaceId, email } },
    select: { tags: true },
  });
  return row?.tags ?? "";
}

/** Convertit le champ de tags séparés par des virgules en liste propre. */
export function parseTags(tags: string | null | undefined): string[] {
  return (tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

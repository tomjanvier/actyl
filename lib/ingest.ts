import "server-only";
import { db } from "@/lib/db";

/** Segments d'annuaire acceptés par l'API publique. */
export const API_CATEGORIES = [
  "SUPPORTER",
  "MEMBER",
  "VOLUNTEER",
  "DONOR",
  "DECISION_MAKER",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_STR = 200;

export function validEmail(email: unknown): string | null {
  const e = typeof email === "string" ? email.trim().toLowerCase().slice(0, MAX_STR) : "";
  return EMAIL_RE.test(e) ? e : null;
}

export function cleanStr(value: unknown, max = MAX_STR): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().slice(0, max);
  return v || null;
}

export function cleanTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return [
    ...new Set(
      raw
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().replace(/,/g, " ").slice(0, 24))
        .filter(Boolean),
    ),
  ].slice(0, 12);
}

/**
 * Recherche ou crée un contact par email dans un espace et actualise les champs
 * fournis. Utilisé par les points d'entrée d'ingestion WordPress.
 * Merges tags instead of replacing them.
 */
export async function upsertContactByEmail(input: {
  workspaceId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  city?: string | null;
  phone?: string | null;
  category?: string | null;
  title?: string | null;
  institution?: string | null;
  themes?: string[] | null;
}): Promise<{ id: string; created: boolean }> {
  // Sépare le prénom et le nom lorsqu'un nom complet est fourni.
  let first = input.firstName?.trim() || "";
  let last = input.lastName?.trim() || "";
  if ((!first && !last) && input.fullName) {
    const parts = input.fullName.trim().split(/\s+/);
    first = parts[0] ?? "";
    last = parts.slice(1).join(" ");
  }

  const existing = await db.contact.findFirst({
    where: { workspaceId: input.workspaceId, email: input.email },
    select: { id: true, category: true },
  });

  if (existing) {
    await db.contact.update({
      where: { id: existing.id },
      data: {
        ...(first ? { firstName: first.slice(0, 80) } : {}),
        ...(last ? { lastName: last.slice(0, 80) } : {}),
        ...(input.city ? { region: input.city.slice(0, 80) } : {}),
        ...(input.phone ? { phone: input.phone.slice(0, 40) } : {}),
        ...(input.title ? { title: input.title.slice(0, 120) } : {}),
        ...(input.institution ? { institution: input.institution.slice(0, 160) } : {}),
        // Ne réduit jamais le segment : DONOR reste prioritaire sur SUPPORTER.
        ...(input.category &&
        categoryRank(input.category) > categoryRank(existing.category)
          ? { category: input.category }
          : {}),
        ...(input.themes?.length
          ? {
              themes: [
                ...new Set(
                  [
                    ...(await db.contact
                      .findUnique({
                        where: { id: existing.id },
                        select: { themes: true },
                      })
                      .then((c) => c?.themes ?? "")),
                    ...input.themes,
                  ]
                    .flatMap((t) => t.split(","))
                    .map((t) => t.trim())
                    .filter(Boolean),
                ),
              ].join(","),
            }
          : {}),
      },
    });
    return { id: existing.id, created: false };
  }

  const contact = await db.contact.create({
    data: {
      workspaceId: input.workspaceId,
      firstName: (first || input.email.split("@")[0]!).slice(0, 80),
      lastName: last.slice(0, 80) || "—",
      email: input.email,
      phone: input.phone?.slice(0, 40) || null,
      region: input.city?.slice(0, 80) || null,
      title: input.title?.slice(0, 120) || null,
      institution: input.institution?.slice(0, 160) || null,
      level: "CIVIL_SOCIETY",
      stance: "ALLY",
      category:
        input.category && API_CATEGORIES.includes(input.category as never)
          ? input.category
          : "SUPPORTER",
      themes: input.themes?.length ? input.themes.join(",") : null,
    },
    select: { id: true },
  });
  return { id: contact.id, created: true };
}

function categoryRank(category: string): number {
  const order = ["SUPPORTER", "MEMBER", "VOLUNTEER", "DONOR", "DECISION_MAKER"];
  return order.indexOf(category);
}

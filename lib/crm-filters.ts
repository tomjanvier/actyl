import type { Prisma } from "@/generated/prisma/client";

export const CONTACT_FILTER_KEYS = ["q", "level", "stance", "party", "institution", "theme", "newsletter"] as const;
export type ContactFilters = Record<(typeof CONTACT_FILTER_KEYS)[number], string>;

export function contactFilters(params: Partial<ContactFilters>): ContactFilters {
  return Object.fromEntries(CONTACT_FILTER_KEYS.map(key => [key, typeof params[key] === "string" ? params[key].trim().slice(0, 300) : ""])) as ContactFilters;
}

export function requestedPage(value?: string): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 && page <= 10000 ? page : 1;
}

// Chaque terme peut porter sur un champ différent, par exemple prénom + nom.
export function contactSearchWhere(filters: ContactFilters, newsletterEnabled: boolean): Prisma.ContactWhereInput {
  return {
    ...(filters.q && { AND: filters.q.split(/\s+/).map(term => ({
      OR: ["firstName", "lastName", "title", "institution", "party", "region", "email", "bio"].map(field => ({
        [field]: { contains: term, mode: "insensitive" },
      })),
    })) }),
    ...(filters.level && { level: filters.level }),
    ...(filters.stance && { stance: filters.stance }),
    ...(filters.party && { party: filters.party }),
    ...(filters.institution && { institution: filters.institution }),
    ...(filters.theme && { themes: { contains: filters.theme, mode: "insensitive" } }),
    ...(newsletterEnabled && filters.newsletter && {
      newsletterStatus: filters.newsletter === "SYNCED" ? { not: null } : filters.newsletter,
    }),
  };
}

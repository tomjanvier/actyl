import "server-only";
import { unstable_cache, updateTag } from "next/cache";
import { parseCommissions } from "@/lib/commission-values";
import { db } from "@/lib/db";

export const publicContactSelection = {
  customValues: { where: { field: { name: "commission" } }, select: { value: true } },
  id: true, firstName: true, lastName: true, title: true, institution: true,
  party: true, region: true, level: true, stance: true, photoUrl: true, themes: true,
} as const;

export function invalidatePublicDirectory() {
  updateTag("public-directory");
}

// Publication is checked afresh before every cached payload is served.
export function getPublishedList(id: string) {
  return db.sharedList.findFirst({ where: { id, isPublished: true }, select: { id: true, name: true, description: true } });
}

const getDirectoryFacets = unstable_cache(
  (id: string) => db.contact.findMany({
    where: { listItems: { some: { listId: id } } },
    select: { party: true, institution: true },
    distinct: ["party", "institution"],
  }),
  ["public-directory-facets-v1"],
  { revalidate: 60, tags: ["public-directory"] },
);

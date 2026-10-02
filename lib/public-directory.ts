import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db";

export const publicContactSelection = {
  id: true, firstName: true, lastName: true, title: true, institution: true,
  party: true, region: true, level: true, stance: true, photoUrl: true, themes: true,
} as const;

export function invalidatePublicDirectory() {
  revalidateTag("public-directory");
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

const loadDirectoryPage = async (id: string, page: number, query: string, level: string, party: string, institution: string, pageSize: number) => {
  const where = directoryWhere(id, query, level, party, institution);
  const orderBy = [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }] as const;
  const loadRows = (page: number) => db.contact.findMany({
    where, select: publicContactSelection,
    orderBy: [...orderBy], skip: (page - 1) * pageSize, take: pageSize,
  });
  const [total, facets, requestedRows] = await Promise.all([
    db.contact.count({ where }),
    getDirectoryFacets(id),
    loadRows(page),
  ]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
  const rows = currentPage === page ? requestedRows : await loadRows(currentPage);
  return { rows, total, page: currentPage, parties: [...new Set(facets.flatMap(r => r.party ? [r.party] : []))].sort(), institutions: [...new Set(facets.flatMap(r => r.institution ? [r.institution] : []))].sort() };
};

const cachedDirectoryPage = unstable_cache(loadDirectoryPage, ["public-directory-v1"], { revalidate: 60, tags: ["public-directory"] });
export function getDirectoryPage(id: string, page: number, query: string, level: string, party: string, institution: string, pageSize: number) {
  // Search terms must not create an unbounded persistent cache.
  const load = query || level || party || institution ? loadDirectoryPage : cachedDirectoryPage;
  return load(id, page, query, level, party, institution, pageSize);
}


function directoryWhere(id: string, query: string, level: string, party: string, institution: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  return {
    listItems: { some: { listId: id } },
    ...(level && { level }), ...(party && { party }), ...(institution && { institution }),
    ...(terms.length && { AND: terms.map(term => ({ OR: ["firstName", "lastName", "title", "party", "themes"].map(field => ({ [field]: { contains: term, mode: "insensitive" as const } })) })) }),
  };
}

export function getDirectoryExport(id: string, query: string, level: string, party: string, institution: string) {
  return db.contact.findMany({ where: directoryWhere(id, query, level, party, institution), select: publicContactSelection, orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }] });
}

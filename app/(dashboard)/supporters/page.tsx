import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { SupportersView } from "@/components/supporters/supporters-view";

export const metadata = { title: "Soutiens" };

const PAGE_SIZE = 100;

/**
 * Base unifiée des soutiens ayant signé, interpellé un décideur ou répondu à un
 * événement, dédupliquée par adresse email dans chaque espace.
 * Pagination serveur par cent entrées pour préserver la réactivité des grandes bases ;
 * les agrégats sont calculés directement en SQL.
 */
export default async function SupportersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireSession();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const where = { workspaceId: session.workspaceId };

  const [supporters, total, engaged, tagRows] = await Promise.all([
    db.supporter.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.supporter.count({ where }),
    db.supporter.count({ where: { ...where, touchCount: { gte: 3 } } }),
    // Lecture ciblée des colonnes utiles aux filtres de tags et d'origine.
    db.supporter.findMany({ where, select: { tags: true, source: true } }),
  ]);

  const allTags = [
    ...new Set(
      tagRows.flatMap((r) =>
        (r.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      ),
    ),
  ].sort();
  const sources = [...new Set(tagRows.map((r) => r.source).filter(Boolean))] as string[];

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Actyl" }, { label: "Soutiens" }]}
        title="Base de soutiens"
        description={`${total.toLocaleString("fr-FR")} personnes engagées avec votre organisation — signatures, interpellations, RSVP.`}
      />
      <SupportersView
        supporters={supporters.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          city: s.city,
          source: s.source,
          tags: s.tags,
          touchCount: s.touchCount,
          lastSeenAt: s.lastSeenAt.toISOString(),
        }))}
        total={total}
        engaged={engaged}
        allTags={allTags}
        sources={sources}
        pagination={{
          page,
          pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
          total,
        }}
      />
    </>
  );
}

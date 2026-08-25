import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { SupportersView } from "@/components/supporters/supporters-view";

export const metadata = { title: "Soutiens" };

const PAGE_SIZE = 100;

/**
 * Unified supporter database — every citizen who signed a petition, emailed a
 * decision-maker or RSVP'd to an event, deduplicated by email.
 * Paginated server-side (100 per page) so large bases stay responsive;
 * aggregates (total, multi-engaged, tags, sources) are computed via SQL.
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

  const [supporters, total, engaged, tagRows, globalCount] = await Promise.all([
    db.supporter.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.supporter.count({ where }),
    db.supporter.count({ where: { ...where, touchCount: { gte: 3 } } }),
    // Single small column scan to build the tag/source filter options.
    db.supporter.findMany({ where, select: { tags: true, source: true } }),
    db.supporter.count({ where: { workspaceId: null } }),
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
        globalCount={globalCount}
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

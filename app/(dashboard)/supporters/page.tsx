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

  const [supporters, stats, tagRows, sourceRows] = await Promise.all([
    db.supporter.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.$queryRaw<Array<{ total: number; engaged: number }>>`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE "touchCount" >= 3)::int AS engaged
      FROM "supporters"
      WHERE "workspaceId" = ${session.workspaceId}
    `,
    db.$queryRaw<Array<{ tag: string }>>`
      SELECT DISTINCT btrim(tag) AS tag
      FROM "supporters"
      CROSS JOIN LATERAL unnest(string_to_array(coalesce("tags", ''), ',')) AS tag
      WHERE "workspaceId" = ${session.workspaceId}
        AND btrim(tag) <> ''
      ORDER BY tag
    `,
    db.$queryRaw<Array<{ source: string }>>`
      SELECT DISTINCT "source"
      FROM "supporters"
      WHERE "workspaceId" = ${session.workspaceId}
        AND "source" IS NOT NULL
      ORDER BY "source"
    `,
  ]);

  const total = stats[0]?.total ?? 0;
  const engaged = stats[0]?.engaged ?? 0;
  const allTags = tagRows.map((row) => row.tag);
  const sources = sourceRows.map((row) => row.source);

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

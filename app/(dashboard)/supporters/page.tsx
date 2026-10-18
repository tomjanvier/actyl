import { supporterSearchWhere } from "@/lib/supporter-search";
import { Prisma } from "@/generated/prisma/client";
import { requestedPage } from "@/lib/crm-filters";
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
  searchParams: Promise<{ page?: string; q?: string; source?: string; tag?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const filters = { q: params.q, source: params.source, tag: params.tag };
  for (const key of ["q", "source", "tag"] as const) {
    filters[key] = typeof filters[key] === "string" ? filters[key].trim().slice(0, 300) : "";
  }
  const { q = "", source = "", tag = "" } = filters;
  const requested = requestedPage(params.page);
  const where = supporterSearchWhere(session.workspaceId, { q, source, tag });
  const loadSupporters = (page: number) => db.$queryRaw<Array<{
    id: string; name: string; email: string; city: string | null;
    source: string | null; tags: string | null; touchCount: number; lastSeenAt: Date;
  }>>(Prisma.sql`
    SELECT "id", "name", "email", "city", "source", "tags", "touchCount", "lastSeenAt"
    FROM "supporters" WHERE ${where}
    ORDER BY "lastSeenAt" DESC, "id" ASC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `);

  const [requestedSupporters, matched, stats, tagRows, sourceRows] = await Promise.all([
    loadSupporters(requested),
    db.$queryRaw<Array<{ total: number }>>(Prisma.sql`SELECT count(*)::int AS total FROM "supporters" WHERE ${where}`),
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

  const filteredTotal = matched[0]?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const page = Math.min(requested, pageCount);
  const supporters = page === requested ? requestedSupporters : await loadSupporters(page);
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
        key={JSON.stringify([filters, page])}
        filters={{ q, source, tag }}
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
          pageCount,
          total: filteredTotal,
        }}
      />
    </>
  );
}

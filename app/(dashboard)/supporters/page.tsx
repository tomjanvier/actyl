import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { SupportersView } from "@/components/supporters/supporters-view";

export const metadata = { title: "Soutiens" };

/**
 * Unified supporter database — every citizen who signed a petition, emailed a
 * decision-maker or RSVP'd to an event, deduplicated by email.
 */
export default async function SupportersPage() {
  const session = await requireSession();

  const [supporters, total] = await Promise.all([
    db.supporter.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { lastSeenAt: "desc" },
    }),
    db.supporter.count({ where: { workspaceId: null } }),
  ]);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Actyl" }, { label: "Soutiens" }]}
        title="Base de soutiens"
        description={`${supporters.length} personnes engagées avec votre organisation — signatures, interpellations, RSVP.`}
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
        globalCount={total}
      />
    </>
  );
}

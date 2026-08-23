import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EventsView } from "@/components/events/events-view";

export const metadata = { title: "Événements" };

export default async function EventsPage() {
  const session = await requireSession();

  const events = await db.event.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { startsAt: "desc" },
    include: {
      rsvps: { select: { id: true, response: true, name: true } },
      campaign: { select: { name: true, emoji: true } },
    },
  });

  return (
    <>
      <PageHeader
        crumbs={[{ label: "AdvocacyHQ" }, { label: "Événements" }]}
        title="Événements & mobilisation terrain"
        description="Réunions, porte-à-porte, formations — publiez et suivez les inscriptions."
      />
      <EventsView
        events={events.map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          location: e.location,
          startsAt: e.startsAt.toISOString(),
          endsAt: e.endsAt?.toISOString() ?? null,
          isPublished: e.isPublished,
          campaignName: e.campaign?.name ?? null,
          yesCount: e.rsvps.filter((r) => r.response === "YES").length,
          maybeCount: e.rsvps.filter((r) => r.response === "MAYBE").length,
          rsvps: e.rsvps.map((r) => ({ id: r.id, response: r.response, name: r.name })),
        }))}
        canManage={can(session.role, "campaign:create")}
        canDelete={can(session.role, "campaign:delete")}
      />
    </>
  );
}

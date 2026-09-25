import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EventsView } from "@/components/events/events-view";

export const metadata = { title: "Événements" };

export default async function EventsPage() {
  const session = await requireSession();

  const [events, rsvpCounts] = await Promise.all([
    db.event.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { startsAt: "desc" },
      take: 100,
      include: {
        rsvps: { select: { id: true, response: true, name: true }, orderBy: { createdAt: "desc" }, take: 20 },
        campaign: { select: { name: true, emoji: true } },
      },
    }),
    db.eventRsvp.groupBy({
      by: ["eventId", "response"],
      where: { event: { workspaceId: session.workspaceId } },
      _count: { _all: true },
    }),
  ]);
  const countsByEvent = new Map<string, { YES: number; MAYBE: number }>();
  for (const count of rsvpCounts) {
    const current = countsByEvent.get(count.eventId) ?? { YES: 0, MAYBE: 0 };
    if (count.response === "YES") current.YES = count._count._all;
    if (count.response === "MAYBE") current.MAYBE = count._count._all;
    countsByEvent.set(count.eventId, current);
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Actyl" }, { label: "Événements" }]}
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
           yesCount: countsByEvent.get(e.id)?.YES ?? 0,
           maybeCount: countsByEvent.get(e.id)?.MAYBE ?? 0,
          rsvps: e.rsvps.map((r) => ({ id: r.id, response: r.response, name: r.name })),
        }))}
        canManage={can(session.role, "campaign:create")}
        canDelete={can(session.role, "campaign:delete")}
      />
    </>
  );
}

import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getSegmentsConfig } from "@/lib/flags";
import { TooltipProvider } from "@/components/ui/controls";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  const [memberships, segments, pinnedCampaigns] = await Promise.all([
    db.membership.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      include: { workspace: { select: { id: true, name: true, slug: true, logoEmoji: true } } },
    }),
    getSegmentsConfig(session.workspaceId),
    db.campaign.findMany({
      where: {
        OR: [
          { workspaceId: session.workspaceId, pinned: true },
          { shares: { some: { workspaceId: session.workspaceId, pinned: true } } },
        ],
      },
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true, emoji: true },
      take: 8,
    }),
  ]);
  const workspaces = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    logoEmoji: m.workspace.logoEmoji,
    role: m.role,
  }));

  // Une requête groupée alimente les compteurs de segments du menu.
  const categoryCounts = segments
    ? await db.contact.groupBy({
        by: ["category"],
        where: { workspaceId: session.workspaceId },
        _count: { _all: true },
      })
    : [];
  const counts = Object.fromEntries(
    categoryCounts.map((c) => [c.category, c._count._all]),
  );

  return (
    <TooltipProvider>
      <div className="flex min-h-screen">
        <Sidebar
          workspace={{
            id: session.workspaceId,
            name: session.workspaceName,
            slug: session.workspaceSlug,
            logoEmoji: session.logoEmoji,
            role: session.role,
          }}
          workspaces={workspaces}
          userName={session.user.name}
          pinnedCampaigns={pinnedCampaigns}
          directorySegments={[
                  { key: "", label: "Tout le répertoire", count: categoryCounts.reduce((n, c) => n + c._count._all, 0) },
                  { key: "DECISION_MAKER", label: "Décideur·e·ses", count: counts.DECISION_MAKER ?? 0 },
                  ...(segments.members ? [{ key: "MEMBER", label: "Adhérent·e·s", count: counts.MEMBER ?? 0 }] : []),
                  ...(segments.volunteers ? [{ key: "VOLUNTEER", label: "Bénévoles", count: counts.VOLUNTEER ?? 0 }] : []),
                  ...(segments.donors ? [{ key: "DONOR", label: "Donateur·ice·s", count: counts.DONOR ?? 0 }] : []),
                  ...(segments.supporters ? [{ key: "SUPPORTER", label: "Soutiens", count: counts.SUPPORTER ?? 0 }] : []),
                ]}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </TooltipProvider>
  );
}

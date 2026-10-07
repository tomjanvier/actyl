import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignsView } from "@/components/campaigns/campaigns-view";

export const metadata = { title: "Campagnes" };

export default async function CampaignsPage() {
  const session = await requireSession();

  const campaigns = await db.campaign.findMany({
    where: {
      OR: [
        { workspaceId: session.workspaceId },
        { shares: { some: { workspaceId: session.workspaceId } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      stages: { select: { kind: true, _count: { select: { cards: true } } } },
      squads: { include: { group: { select: { name: true, color: true } } } },
      _count: {
        select: {
          cards: true,
          blasts: true,
          templates: true,
        },
      },
      workspace: { select: { id: true, name: true } },
      shares: {
        where: { workspaceId: session.workspaceId },
        select: { access: true, pinned: true },
      },
    },
  });

  const serialized = campaigns.map((c) => {
    const stats = c.stages.reduce((total, stage) => {
      const count = stage._count.cards;
      total.total += count;
      if (stage.kind === "WON") total.won += count;
      if (stage.kind === "POSITIVE" || stage.kind === "WON") total.allies += count;
      if (stage.kind === "NEGATIVE") total.opponents += count;
      return total;
    }, { total: 0, won: 0, allies: 0, opponents: 0 });
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      emoji: c.emoji,
      description: c.description,
      status: c.status,
      isPublished: c.isPublished,
      priority: c.priority,
      dueDate: c.dueDate?.toISOString() ?? null,
      squads: c.squads.map((s) => s.group),
      cardCount: c._count.cards,
      templateCount: c._count.templates,
      blastCount: c._count.blasts,
      won: stats.won,
      allies: stats.allies,
      opponents: stats.opponents,
      progress: stats.total ? Math.round((stats.won / stats.total) * 100) : 0,
      sharedBy: c.workspaceId === session.workspaceId ? null : c.workspace.name,
      shareAccess: c.shares[0]?.access ?? null,
    };
  });

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Actyl" }, { label: "Campagnes" }]}
        title="Campagnes de plaidoyer"
        description="Chaque campagne dispose d'un pipeline kanban et d'un moteur d'interpellation citoyenne."
        actions={
          can(session.role, "campaign:create") ? (
            <Link
              href="/campaigns?new=1"
              className="inline-flex h-8 items-center gap-2 rounded-lg bg-accent px-3 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover"
            >
              + Nouvelle campagne
            </Link>
          ) : null
        }
      />
      <CampaignsView campaigns={serialized} canCreate={can(session.role, "campaign:create")} />
    </>
  );
}

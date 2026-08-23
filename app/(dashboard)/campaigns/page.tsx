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
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      squads: { include: { group: { select: { name: true, color: true } } } },
      _count: {
        select: {
          cards: true,
          blasts: true,
          templates: true,
        },
      },
      cards: {
        include: {
          stage: { select: { kind: true, name: true } },
        },
      },
    },
  });

  const serialized = campaigns.map((c) => {
    const won = c.cards.filter((k) => k.stage.kind === "WON").length;
    const allies = c.cards.filter(
      (k) => k.stage.kind === "POSITIVE" || k.stage.kind === "WON",
    ).length;
    const opponents = c.cards.filter((k) => k.stage.kind === "NEGATIVE").length;
    const emails = c._count.blasts;
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      emoji: c.emoji,
      description: c.description,
      status: c.status,
      priority: c.priority,
      dueDate: c.dueDate?.toISOString() ?? null,
      squads: c.squads.map((s) => s.group),
      cardCount: c._count.cards,
      templateCount: c._count.templates,
      blastCount: c._count.blasts,
      won,
      allies,
      opponents,
      progress: c.cards.length ? Math.round((won / c.cards.length) * 100) : 0,
    };
  });

  return (
    <>
      <PageHeader
        crumbs={[{ label: "AdvocacyHQ" }, { label: "Campagnes" }]}
        title="Campagnes de plaidoyer"
        description="Chaque campagne dispose d'un pipeline kanban et d'un moteur d'interpellation citoyenne."
        actions={
          can(session.role, "campaign:create") ? (
            <Link
              href="/campaigns?new=1"
              className="inline-flex h-8 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
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

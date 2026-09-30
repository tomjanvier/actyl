import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CalendarDays, Megaphone } from "lucide-react";
import { db } from "@/lib/db";
import { ActylLogo } from "@/components/layout/actyl-logo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}): Promise<Metadata> {
  const { workspaceSlug } = await params;
  const workspace = await db.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { name: true },
  });
  return { title: workspace ? workspace.name : "Association" };
}

export default async function AssociationPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = await db.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: {
      name: true,
      slug: true,
      logoEmoji: true,
      website: true,
      campaigns: {
        where: { isPublished: true, status: { notIn: ["ARCHIVED", "LOST"] } },
        orderBy: { createdAt: "desc" },
        select: {
          slug: true,
          name: true,
          emoji: true,
          description: true,
          petition: { where: { isPublished: true }, select: { id: true } },
          _count: { select: { cards: true } },
        },
      },
      events: {
        where: { isPublished: true, startsAt: { gte: new Date() } },
        orderBy: { startsAt: "asc" },
        take: 4,
        select: { id: true, title: true, location: true, startsAt: true },
      },
    },
  });
  if (!workspace) notFound();

  return (
    <main className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="flex items-center justify-between border-b border-line pb-5">
          <Link href="/" aria-label="Accueil Actyl"><ActylLogo className="h-7 w-28" /></Link>
          {workspace.website && (
            <a href={workspace.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-mut hover:text-fg">
              Site de l’association <ArrowUpRight className="size-4" />
            </a>
          )}
        </header>

        <section className="relative mt-8 overflow-hidden rounded-3xl border border-line bg-card px-6 py-10 sm:px-12 sm:py-14">
          <div aria-hidden="true" className="absolute -right-20 -top-24 size-72 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative max-w-2xl">
            <div className="mb-5 inline-flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-3xl ring-1 ring-inset ring-accent-ring">{workspace.logoEmoji}</div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Espace associatif</p>
            <h1 className="mt-2 text-balance text-4xl font-semibold tracking-tight text-fg sm:text-5xl">{workspace.name}</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-mut">Découvrez nos campagnes publiques et les actions citoyennes auxquelles vous pouvez prendre part.</p>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Agir ensemble</p><h2 className="mt-1 text-2xl font-semibold text-fg">Campagnes publiques</h2></div>
            <span className="rounded-full bg-elev px-3 py-1 text-xs text-mut">{workspace.campaigns.length} campagne{workspace.campaigns.length > 1 ? "s" : ""}</span>
          </div>
          {workspace.campaigns.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {workspace.campaigns.map((campaign) => (
                <Link key={campaign.slug} href={`/association/${workspace.slug}/${campaign.slug}`} className="group rounded-2xl border border-line bg-card p-5 transition-colors hover:border-accent-ring hover:bg-raised focus-visible:outline-offset-4">
                  <div className="flex items-start justify-between gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-elev text-2xl">{campaign.emoji}</span><ArrowUpRight className="mt-1 size-4 text-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
                  <h3 className="mt-4 text-xl font-semibold text-fg">{campaign.name}</h3>
                  {campaign.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-mut">{campaign.description}</p>}
                  <div className="mt-5 flex flex-wrap gap-2 text-xs text-faint">
                    <span className="rounded-full bg-elev px-2.5 py-1">{campaign._count.cards} décideur{campaign._count.cards > 1 ? "s" : ""}</span>
                    {campaign.petition && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-fg">Pétition ouverte</span>}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-card px-6 py-12 text-center"><Megaphone className="mx-auto size-6 text-faint"/><p className="mt-3 font-medium text-fg">Aucune campagne publique pour le moment</p><p className="mt-1 text-sm text-faint">Revenez bientôt découvrir nos prochaines actions.</p></div>
          )}
        </section>

        {workspace.events.length > 0 && <section className="mt-12">
          <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Se retrouver</p><h2 className="mt-1 text-2xl font-semibold text-fg">Prochains rendez-vous</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {workspace.events.map((event) => <Link key={event.id} href={`/e/${event.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 transition-colors hover:bg-raised"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elev"><CalendarDays className="size-5 text-mut"/></span><span className="min-w-0"><span className="block truncate font-medium text-fg">{event.title}</span><span className="mt-1 block text-xs text-faint">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(event.startsAt)}{event.location ? ` · ${event.location}` : ""}</span></span></Link>)}
          </div>
        </section>}

        <footer className="mt-14 flex flex-col items-center gap-3 border-t border-line pt-6 text-center"><ActylLogo className="h-6 w-24"/><p className="text-xs text-faint">Espace public de {workspace.name} · Propulsé par Actyl</p></footer>
      </div>
    </main>
  );
}

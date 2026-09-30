import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { CitizenForm } from "@/components/public/citizen-form";
import { PetitionSignForm, ShareSection } from "@/components/public/petition-and-share";
import { ActylLogo } from "@/components/layout/actyl-logo";

export async function PublicCampaignPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; campaignSlug: string }>;
}) {
  const { workspaceSlug, campaignSlug } = await params;

  const publicCampaigns = await db.campaign.findMany({
    where: { slug: campaignSlug, workspace: { slug: workspaceSlug }, isPublished: true, status: { notIn: ["ARCHIVED", "LOST"] } },
    take: 2,
    select: {
      id: true,
      name: true,
      emoji: true,
      description: true,
      workspace: { select: { name: true, logoEmoji: true, slug: true } },
      templates: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        take: 1,
        select: { subject: true, body: true },
      },
      cards: {
        include: {
          contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          institution: true,
          party: true,
          email: true,
          region: true,
        },
          },
        },
        where: { stage: { kind: { not: "NEGATIVE" } } },
      },
      petition: {
        where: { isPublished: true },
        include: {
          signatures: {
            orderBy: { createdAt: "desc" },
            take: 12,
            select: { id: true, name: true, city: true, createdAt: true },
          },
        },
      },
      _count: {
        select: {
          blasts: true,
        },
      },
    },
  });
  // Le slug n'est unique qu'à l'intérieur d'un espace : refuse les collisions.
  const campaign = publicCampaigns[0];
  if (!campaign || publicCampaigns.length !== 1) notFound();

  const targets = campaign.cards.filter((c) => c.contact.email);
  const petition = campaign.petition?.isPublished ? campaign.petition : null;

  // Parallel counters instead of sequential round-trips.
  const [totalEmails, signatureCount] = await Promise.all([
    db.sentEmail.count({
      where: {
        blast: { campaignId: campaign.id },
        contactId: { in: targets.map((t) => t.contact.id) },
        status: "SENT",
        OR: [{ providerId: null }, { NOT: { providerId: { startsWith: "sim_" } } }],
      },
    }),
    petition
      ? db.petitionSignature.count({ where: { petitionId: petition.id } })
      : Promise.resolve(0),
  ]);

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <header className="text-center">
          <Link href={`/association/${campaign.workspace.slug}`} className="mb-4 inline-flex items-center gap-2 rounded-full bg-elev px-3 py-1 text-[12px] text-mut ring-1 ring-inset ring-line transition-colors hover:text-fg">
            <span>{campaign.workspace.logoEmoji}</span>
            {campaign.workspace.name} · voir toutes les campagnes
          </Link>
          <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-fg">
            <span className="mr-2">{campaign.emoji}</span>
            {campaign.name}
          </h1>
          {campaign.description && (
            <p className="mx-auto mt-4 max-w-xl text-balance text-[14px] leading-relaxed text-faint">
              {campaign.description}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px]">
            <span>
              <strong className="text-plum-700 tabular-nums dark:text-coral-300">{totalEmails}</strong>{" "}
              <span className="text-faint">emails déjà envoyés</span>
            </span>
            {petition && (
              <span>
                <strong className="text-plum-700 tabular-nums dark:text-coral-300">{signatureCount}</strong>{" "}
                <span className="text-faint">signatures</span>
              </span>
            )}
            <span>
              <strong className="text-plum-700 tabular-nums dark:text-coral-300">{targets.length}</strong>{" "}
              <span className="text-faint">décideurs ciblés</span>
            </span>
          </div>
        </header>

        {/* Targets */}
        <section className="mt-10">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-faint">
            Décideurs interpellés
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {targets.map(({ contact }) => (
              <div
                key={contact.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg">
                    {contact.firstName} {contact.lastName}
                  </p>
                  <p className="truncate text-[11.5px] text-faint">
                    {[contact.title, contact.institution].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Form */}
        {campaign.templates[0] && targets.length > 0 ? <CitizenForm
          campaignName={campaign.name}
          campaignSlug={campaignSlug}
          workspaceSlug={workspaceSlug}
          defaultSubject={campaign.templates[0].subject}
          defaultBody={campaign.templates[0].body}
          regions={[
            ...new Set(
              campaign.cards
                .map((c) => c.contact.region?.trim())
                .filter((r): r is string => !!r),
            ),
          ]}
        /> : (
          <section className="mt-10 rounded-2xl border border-dashed border-line bg-card p-6 text-center">
            <h2 className="font-semibold text-fg">Interpellation bientôt disponible</h2>
            <p className="mt-2 text-sm text-faint">Cette association prépare encore les messages de sa campagne.</p>
          </section>
        )}

        {/* Petition */}
        {petition && (
          <section className="mt-10 rounded-2xl border border-line bg-card p-6">
            <h2 className="text-[17px] font-semibold text-fg">
              🖊️ {petition.title}
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-mut">
              {petition.description}
            </p>
            {/* Progress */}
            <div className="mt-5">
              <div className="flex items-baseline justify-between text-[12.5px]">
                <span className="font-semibold text-plum-700 tabular-nums dark:text-coral-300">
                  {signatureCount} signatures
                </span>
                <span className="text-faint">objectif : {petition.goal}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-elev">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: `${Math.min(100, Math.max(signatureCount > 0 ? 3 : 0, Math.round((signatureCount / Math.max(petition.goal, 1)) * 100)))}%`,
                  }}
                />
              </div>
            </div>
            <PetitionSignForm campaignSlug={campaignSlug} workspaceSlug={workspaceSlug} signatureCount={signatureCount} canInterpellate={!!campaign.templates[0] && targets.length > 0} />
            {petition.signatures.length > 0 && (
              <p className="mt-4 break-words text-[11.5px] leading-relaxed text-faint">
                Derniers signataires :{" "}
                {petition.signatures
                  .map((s) => s.name + (s.city ? ` (${s.city})` : ""))
                  .join(" · ")}
              </p>
            )}
          </section>
        )}

        {/* Share (ActionButton-style) */}
        <ShareSection title={campaign.name} />

        <footer className="mt-12 border-t border-line pt-6 text-center">
          <ActylLogo className="mb-4 h-7 w-[112px]" />
          <p className="text-[11.5px] leading-relaxed text-faint">
            Propulsé par{" "}
            <Link href="/" className="text-faint hover:text-mut">
              Actyl
            </Link>{" "}
            — CRM de plaidoyer open-source.
            <br />
            Vos coordonnées permettent de gérer votre participation à cette campagne.
          </p>
        </footer>
      </div>
    </div>
  );
}

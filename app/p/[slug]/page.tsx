import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { CitizenForm } from "@/components/public/citizen-form";
import { PetitionSignForm, ShareSection } from "@/components/public/petition-and-share";

export const metadata = { title: "Interpellation citoyenne" };

export default async function PublicCampaignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const campaign = await db.campaign.findFirst({
    where: { slug, status: { notIn: ["ARCHIVED", "LOST"] } },
    select: {
      id: true,
      name: true,
      emoji: true,
      description: true,
      workspace: { select: { name: true, logoEmoji: true } },
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
  if (!campaign || !campaign.templates[0]) notFound();

  const targets = campaign.cards.filter((c) => c.contact.email);
  const petition = campaign.petition?.isPublished ? campaign.petition : null;

  // Parallel counters instead of sequential round-trips.
  const [totalEmails, signatureCount] = await Promise.all([
    db.sentEmail.count({
      where: {
        contactId: { in: targets.map((t) => t.contact.id) },
        status: "SENT",
      },
    }),
    petition
      ? db.petitionSignature.count({ where: { petitionId: petition.id } })
      : Promise.resolve(0),
  ]);

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-2xl px-6 py-12">
        {/* Header */}
        <header className="text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-elev px-3 py-1 text-[12px] text-mut ring-1 ring-inset ring-line">
            <span>{campaign.workspace.logoEmoji}</span>
            Campagne portée par {campaign.workspace.name}
          </p>
          <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-fg">
            <span className="mr-2">{campaign.emoji}</span>
            {campaign.name}
          </h1>
          {campaign.description && (
            <p className="mx-auto mt-4 max-w-xl text-balance text-[14px] leading-relaxed text-faint">
              {campaign.description}
            </p>
          )}
          <div className="mt-5 flex items-center justify-center gap-6 text-[13px]">
            <span>
              <strong className="text-emerald-400 tabular-nums">{totalEmails}</strong>{" "}
              <span className="text-zinc-500">emails déjà envoyés</span>
            </span>
            {petition && (
              <span>
                <strong className="text-indigo-400 tabular-nums">{signatureCount}</strong>{" "}
                <span className="text-zinc-500">signatures</span>
              </span>
            )}
            <span>
              <strong className="text-indigo-400 tabular-nums">{targets.length}</strong>{" "}
              <span className="text-zinc-500">décideurs ciblés</span>
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
        <CitizenForm
          campaignSlug={slug}
          defaultSubject={campaign.templates[0].subject}
          defaultBody={campaign.templates[0].body}
          regions={[
            ...new Set(
              campaign.cards
                .map((c) => c.contact.region?.trim())
                .filter((r): r is string => !!r),
            ),
          ]}
        />

        {/* Petition */}
        {petition && (
          <section className="mt-10 rounded-2xl border border-white/[0.07] bg-card p-6">
            <h2 className="text-[17px] font-semibold text-zinc-50">
              🖊️ {petition.title}
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-zinc-400">
              {petition.description}
            </p>
            {/* Progress */}
            <div className="mt-5">
              <div className="flex items-baseline justify-between text-[12.5px]">
                <span className="font-semibold text-indigo-400 tabular-nums">
                  {signatureCount} signatures
                </span>
                <span className="text-zinc-600">objectif : {petition.goal}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400"
                  style={{
                    width: `${Math.min(100, Math.max(signatureCount > 0 ? 3 : 0, Math.round((signatureCount / Math.max(petition.goal, 1)) * 100)))}%`,
                  }}
                />
              </div>
            </div>
            <PetitionSignForm campaignSlug={slug} signatureCount={signatureCount} />
            {petition.signatures.length > 0 && (
              <p className="mt-4 truncate text-[11.5px] leading-relaxed text-zinc-600">
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
          <p className="text-[11.5px] leading-relaxed text-faint">
            Propulsé par{" "}
            <Link href="/" className="text-faint hover:text-mut">
              Actyl
            </Link>{" "}
            — CRM de plaidoyer open-source.
            <br />
            Vos coordonnées sont utilisées uniquement pour signer votre message.
          </p>
        </footer>
      </div>
    </div>
  );
}

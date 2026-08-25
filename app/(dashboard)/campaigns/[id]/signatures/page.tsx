import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { CampaignHeader } from "@/components/campaigns/campaign-header";
import { SignaturesView } from "@/components/campaigns/signatures-view";

export const metadata = { title: "Signataires" };

const PAGE_SIZE = 100;

/**
 * Back office for one campaign's petition: full signer list with server-side
 * pagination (100 per page), search, city filter, CSV export, conversion to
 * directory contacts and broadcast emailing.
 */
export default async function SignaturesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; city?: string; page?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const { q, city, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const campaign = await db.campaign.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: {
      id: true,
      name: true,
      slug: true,
      emoji: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      squads: { select: { group: { select: { name: true, color: true } } } },
      petition: { select: { id: true, title: true, goal: true, isPublished: true } },
    },
  });
  if (!campaign) notFound();

  const qTrim = q?.trim() ?? "";
  const cityTrim = city?.trim() ?? "";
  const where = campaign.petition
    ? {
        petitionId: campaign.petition.id,
        ...(cityTrim ? { city: { equals: cityTrim } } : {}),
        ...(qTrim
          ? {
              OR: [
                { name: { contains: qTrim } },
                { email: { contains: qTrim } },
                { city: { contains: qTrim } },
              ],
            }
          : {}),
      }
    : null;

  const [signatures, filteredTotal, totalSignatures, cityRows] = where
    ? await Promise.all([
        db.petitionSignature.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: PAGE_SIZE,
          skip: (page - 1) * PAGE_SIZE,
        }),
        db.petitionSignature.count({ where }),
        db.petitionSignature.count({ where: { petitionId: where.petitionId } }),
        db.petitionSignature.groupBy({
          by: ["city"],
          where: { petitionId: where.petitionId, city: { not: null } },
          _count: { id: true },
          orderBy: { _count: { city: "desc" } },
          take: 200,
        }),
      ])
    : [[], 0, 0, []];

  return (
    <>
      <CampaignHeader
        campaign={{
          id: campaign.id,
          name: campaign.name,
          slug: campaign.slug,
          emoji: campaign.emoji,
          description: campaign.description,
          status: campaign.status,
          priority: campaign.priority,
          dueDate: campaign.dueDate?.toISOString() ?? null,
          squads: campaign.squads.map((s) => ({ name: s.group.name, color: s.group.color })),
        }}
        canEdit={can(session.role, "campaign:edit")}
      />
      <SignaturesView
        campaignId={campaign.id}
        campaignSlug={campaign.slug}
        canManage={can(session.role, "email:send")}
        petition={
          campaign.petition
            ? {
                title: campaign.petition.title,
                goal: campaign.petition.goal,
                isPublished: campaign.petition.isPublished,
                totalSignatures,
              }
            : null
        }
        signatures={signatures.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          city: s.city,
          createdAt: s.createdAt.toISOString(),
        }))}
        cities={cityRows.map((r) => r.city).filter((c): c is string => !!c)}
        pagination={{
          page,
          pageCount: Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE)),
          total: filteredTotal,
        }}
      />
    </>
  );
}

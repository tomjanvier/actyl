import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { CampaignHeader } from "@/components/campaigns/campaign-header";
import { EmailsView } from "@/components/emails/emails-view";

export const metadata = { title: "Interpellation" };

export default async function EmailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const campaign = await db.campaign.findFirst({
    where: { id, workspaceId: session.workspaceId },
    include: { squads: { include: { group: true } } },
  });
  if (!campaign) notFound();

  const [templates, cards, blasts, sentEmails] = await Promise.all([
    db.emailTemplate.findMany({
      where: { campaignId: campaign.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    db.kanbanCard.findMany({
      where: { campaignId: campaign.id },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            institution: true,
            email: true,
            avatarColor: true,
          },
        },
        stage: { select: { name: true, kind: true } },
      },
    }),
    db.emailBlast.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        template: { select: { name: true } },
        creator: { select: { name: true } },
        _count: { select: { emails: true } },
      },
    }),
    db.sentEmail.findMany({
      where: { contact: { cards: { some: { id: campaign.id } } } },
      select: { contactId: true, status: true, openedAt: true, senderName: true },
    }),
  ]);

  // Per-target stats
  const targetStats = new Map<
    string,
    { total: number; opened: number; citizens: Set<string> }
  >();
  for (const e of sentEmails) {
    const s =
      targetStats.get(e.contactId) ?? { total: 0, opened: 0, citizens: new Set() };
    if (e.status !== "FAILED") s.total++;
    if (e.openedAt) s.opened++;
    if (e.senderName) s.citizens.add(e.senderName);
    targetStats.set(e.contactId, s);
  }

  const totals = [...targetStats.values()].reduce(
    (acc, s) => ({
      sent: acc.sent + s.total,
      opened: acc.opened + s.opened,
      citizens: Math.max(acc.citizens, s.citizens.size),
    }),
    { sent: 0, opened: 0, citizens: 0 },
  );
  const uniqueCitizens = new Set(sentEmails.map((e) => e.senderName).filter(Boolean))
    .size;

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
      <EmailsView
        campaignId={campaign.id}
        campaignSlug={campaign.slug}
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          subject: t.subject,
          body: t.body,
          isDefault: t.isDefault,
        }))}
        targets={cards
          .filter((c) => c.contact.email)
          .map((c) => ({
            cardId: c.id,
            contact: c.contact,
            stageName: c.stage.name,
            emailsReceived: targetStats.get(c.contact.id)?.total ?? 0,
            opens: targetStats.get(c.contact.id)?.opened ?? 0,
            uniqueCitizens: targetStats.get(c.contact.id)?.citizens.size ?? 0,
          }))}
        unjoinableCount={cards.length - cards.filter((c) => c.contact.email).length}
        blasts={blasts.map((b) => ({
          id: b.id,
          subject: b.subject,
          source: b.source,
          templateName: b.template.name,
          creatorName: b.creator?.name ?? "—",
          emailCount: b._count.emails,
          createdAt: b.createdAt.toISOString(),
        }))}
        stats={{
          sent: totals.sent,
          openRate: totals.sent ? Math.round((totals.opened / totals.sent) * 100) : 0,
          uniqueCitizens,
        }}
        canSend={can(session.role, "email:send")}
        canManageTemplates={can(session.role, "template:manage")}
      />
    </>
  );
}

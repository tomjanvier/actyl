import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { getSegmentsConfig } from "@/lib/flags";
import { getNewsletterConfig } from "@/lib/newsletter";
import { PageHeader } from "@/components/layout/page-header";
import { ContactsView } from "@/components/contacts/contacts-view";
import { getDisabledReferencePacks } from "@/lib/reference-pack-settings";
import type { ReferencePackKey } from "@/lib/datasets/reference-packs";

export const metadata = { title: "Contacts" };

const PAGE_SIZE = 100;

const CATEGORY_LABELS: Record<string, string> = {
  DECISION_MAKER: "Décideur·e·ses",
  MEMBER: "Adhérent·e·s",
  VOLUNTEER: "Bénévoles",
  DONOR: "Donateur·ice·s",
  SUPPORTER: "Soutiens",
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    page?: string;
    list?: string;
    contact?: string;
  }>;
}) {
  const session = await requireSession();
  const {
    category,
    page: pageParam,
    list: requestedListId,
    contact: initialContactId,
  } = await searchParams;
  const [segments, newsletter, directoryLists, disabledReferencePacks, groups] = await Promise.all([
    getSegmentsConfig(session.workspaceId),
    getNewsletterConfig(session.workspaceId),
    db.sharedList.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sourcePack: true },
    }),
    getDisabledReferencePacks(session.workspaceId),
    db.group.findMany({
      where: {
        workspaceId: session.workspaceId,
        ...(session.role === "ADMIN"
          ? {}
          : { members: { some: { membership: { userId: session.user.id } } } }),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);
  const visibleLists = directoryLists.filter(
    (list) =>
      !list.sourcePack ||
      !disabledReferencePacks.has(list.sourcePack as ReferencePackKey),
  );
  const activeList = visibleLists.find((list) => list.id === requestedListId);
  const enabledCategories = new Set([
    "DECISION_MAKER",
    ...(segments.members ? ["MEMBER"] : []),
    ...(segments.volunteers ? ["VOLUNTEER"] : []),
    ...(segments.donors ? ["DONOR"] : []),
    ...(segments.supporters ? ["SUPPORTER"] : []),
  ]);
  // N'applique le filtre que si le segment est actif et reconnu.
  const activeCategory =
    category && enabledCategories.has(category) ? category : null;

  // La pagination serveur limite la réponse à cent contacts.
  const page = Math.max(1, Number(pageParam) || 1);
  const newsletterEnabled = newsletter.enabled;
  const where = {
    workspaceId: session.workspaceId,
    ...(activeCategory ? { category: activeCategory } : {}),
    ...(activeList ? { listItems: { some: { listId: activeList.id } } } : {}),
  };

  const [contacts, total, fields] = await Promise.all([
      db.contact.findMany({
        where,
        orderBy: [{ lastName: "asc" }],
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          title: true,
          institution: true,
          party: true,
          region: true,
          level: true,
          stance: true,
          influenceScore: true,
          bio: true,
          photoUrl: true,
          themes: true,
          twitter: true,
          linkedin: true,
          website: true,
          avatarColor: true,
          createdAt: true,
          updatedAt: true,
          newsletterStatus: newsletterEnabled ? true : false,
          newsletterSyncedAt: newsletterEnabled ? true : false,
          customValues: {
            select: { fieldId: true, value: true, field: { select: { name: true } } },
          },
        },
      }),
      db.contact.count({ where }),
      db.customField.findMany({
        where: { workspaceId: session.workspaceId },
        orderBy: { position: "asc" },
      }),
    ]);

  const contactIds = contacts.map((contact) => contact.id);
  const groupIds = groups.map((group) => group.id);
  const [myNotes, myPrivateData, orgNoteRows, emailCounts, candidateTeams] = contactIds.length
    ? await Promise.all([
      db.privateNote.findMany({
        where: {
          authorId: session.user.id,
          contactId: { in: contactIds },
        },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        select: { id: true, contactId: true, body: true, pinned: true, createdAt: true },
      }),
      db.contactPrivateData.findMany({
        where: { userId: session.user.id, contactId: { in: contactIds } },
        select: { contactId: true, rating: true, tags: true, status: true },
      }),
      db.orgNote.findMany({
        where: { workspaceId: session.workspaceId, contactId: { in: contactIds } },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        select: { id: true, contactId: true, authorName: true, body: true, pinned: true, createdAt: true },
      }),
      db.sentEmail.groupBy({
        by: ["contactId"],
        where: { contactId: { in: contactIds } },
        _count: { id: true },
      }),
      db.campaignTeam.findMany({
        where: {
          workspaceId: session.workspaceId,
          candidateContactId: { in: contactIds },
          list: { sourcePack: "presidentielle-2027" },
        },
        select: {
          id: true,
          candidateName: true,
          candidateContactId: true,
          programUrl: true,
          positions: {
            where: { groupId: { in: groupIds } },
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              topic: true,
              summary: true,
              stance: true,
              authorId: true,
              group: { select: { name: true } },
            },
          },
        },
      }),
    ])
    : [[], [], [], [], []] as const;

  const emailCountMap = new Map(
    emailCounts.map((row) => [row.contactId, row._count.id]),
  );

  const serialized = contacts.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    newsletterStatus: (c as { newsletterStatus?: string | null }).newsletterStatus ?? null,
    newsletterSyncedAt:
      (c as { newsletterSyncedAt?: Date | null }).newsletterSyncedAt?.toISOString() ?? null,
    customValues: Object.fromEntries(
      c.customValues.map((cv) => [cv.fieldId, cv.value ?? ""]),
    ),
    emailsReceived: emailCountMap.get(c.id) ?? 0,
  }));

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Actyl" }, { label: "Contacts" }]}
        title={
          activeList
            ? activeList.name
            : activeCategory
            ? CATEGORY_LABELS[activeCategory]!
            : enabledCategories.size > 1
              ? "Répertoire"
              : "Annuaire des décideurs"
        }
        description={
          activeList
            ? `${total.toLocaleString("fr-FR")} contact(s) dans cette liste partagée. Ouvrez une fiche pour la modifier ou proposer une correction.`
            : activeCategory
            ? `Segment ${CATEGORY_LABELS[activeCategory]!.toLowerCase()} — ${total.toLocaleString("fr-FR")} fiche(s). Vos notes et évaluations personnelles restent privées.`
            : enabledCategories.size > 1
              ? `Toute votre base (${total.toLocaleString("fr-FR")} fiches) — décideurs, adhérent·e·s, bénévoles, donateur·ice·s et soutiens. Vos notes et évaluations personnelles restent privées.`
              : `Base centralisée et partagée (${total.toLocaleString("fr-FR")} fiches) : parlementaires, exécutifs, secteur privé, presse. Vos notes et évaluations personnelles restent privées.`
        }
      />
      <ContactsView
        contacts={serialized}
        fields={fields.map((f) => ({
          id: f.id,
          label: f.label,
          name: f.name,
          type: f.type,
          options: f.options,
        }))}
        notes={myNotes.map((n) => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
        }))}
        orgNotes={orgNoteRows.map((n) => ({
          id: n.id,
          contactId: n.contactId,
          authorName: n.authorName,
          body: n.body,
          pinned: n.pinned,
          createdAt: n.createdAt.toISOString(),
        }))}
        privateData={Object.fromEntries(
          myPrivateData.map((p) => [
            p.contactId,
            { rating: p.rating, tags: p.tags ?? "", status: p.status ?? "" },
          ]),
        )}
        canEdit={can(session.role, "contact:create")}
        canDelete={can(session.role, "campaign:delete")}
        canNewsletter={can(session.role, "email:send")}
        extendedDirectory={enabledCategories.size > 1}
        newsletterEnabled={newsletterEnabled}
        lists={visibleLists.map((list) => ({ id: list.id, name: list.name }))}
        activeListId={activeList?.id ?? ""}
        initialContactId={initialContactId ?? null}
        candidateProfiles={Object.fromEntries(
          candidateTeams.flatMap((team) =>
            team.candidateContactId
              ? [[team.candidateContactId, {
                  teamId: team.id,
                  candidateName: team.candidateName,
                  programUrl: team.programUrl,
                  positions: team.positions.map((position) => ({
                    id: position.id,
                    topic: position.topic,
                    summary: position.summary,
                    stance: position.stance,
                    groupName: position.group?.name ?? "Équipe non renseignée",
                    canDelete:
                      session.role === "ADMIN" || position.authorId === session.user.id,
                  })),
                }]]
              : [],
          ),
        )}
        politicalGroups={groups}
        canAddPoliticalPosition={can(session.role, "note:add") && groups.length > 0}
        pagination={{ page, pageCount, total }}
      />
    </>
  );
}

import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { getExtendedDirectory } from "@/lib/flags";
import { PageHeader } from "@/components/layout/page-header";
import { ContactsView } from "@/components/contacts/contacts-view";

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
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const session = await requireSession();
  const { category, page: pageParam } = await searchParams;
  const extendedDirectory = await getExtendedDirectory();
  // Only honor the filter when the feature is on and the value is known.
  const activeCategory =
    extendedDirectory && category && CATEGORY_LABELS[category] ? category : null;

  // Server-side pagination keeps the payload light (100 contacts per page).
  const page = Math.max(1, Number(pageParam) || 1);
  const where = {
    workspaceId: session.workspaceId,
    ...(activeCategory ? { category: activeCategory } : {}),
  };

  const [contacts, total, fields, myNotes, myPrivateData, orgNoteRows, emailCounts] =
    await Promise.all([
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
      db.privateNote.findMany({
        where: {
          authorId: session.user.id,
          contact: { workspaceId: session.workspaceId },
        },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        select: { id: true, contactId: true, body: true, pinned: true, createdAt: true },
      }),
      db.contactPrivateData.findMany({
        where: { userId: session.user.id },
        select: { contactId: true, rating: true, tags: true, status: true },
      }),
      db.orgNote.findMany({
        where: { workspaceId: session.workspaceId },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        select: { id: true, contactId: true, authorName: true, body: true, pinned: true, createdAt: true },
      }),
      db.sentEmail.groupBy({
        by: ["contactId"],
        where: { contact: { workspaceId: session.workspaceId } },
        _count: { id: true },
      }),
    ]);

  const serialized = contacts.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    customValues: Object.fromEntries(
      c.customValues.map((cv) => [cv.fieldId, cv.value ?? ""]),
    ),
    emailsReceived:
      emailCounts.find((e) => e.contactId === c.id)?._count.id ?? 0,
  }));

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Actyl" }, { label: "Contacts" }]}
        title={
          activeCategory
            ? CATEGORY_LABELS[activeCategory]!
            : extendedDirectory
              ? "Répertoire"
              : "Annuaire des décideurs"
        }
        description={
          activeCategory
            ? `Segment ${CATEGORY_LABELS[activeCategory]!.toLowerCase()} — ${total.toLocaleString("fr-FR")} fiche(s). Vos notes et évaluations personnelles restent privées.`
            : extendedDirectory
              ? `Toute votre base (${total.toLocaleString("fr-FR")} fiches) — décideurs, adhérent·e·s, bénévoles, donateur·ice·s et soutiens. Vos notes et évaluations personnelles restent privées.`
              : `Base centralisée et partagée (${total.toLocaleString("fr-FR")} fiches) : parlementaires, exécutifs, secteur privé, presse. Vos notes et évaluations personnelles restent privées.`
        }
      />
      <ContactsView
        contacts={serialized}
        total={total}
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
        extendedDirectory={extendedDirectory}
        pagination={{ page, pageCount, total }}
      />
    </>
  );
}

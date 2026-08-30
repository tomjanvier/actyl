import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { ListsView } from "@/components/lists/lists-view";
import { getDisabledReferencePacks } from "@/lib/reference-pack-settings";

export const metadata = { title: "Listes partagées" };

function proposalName(payload: string) {
  try {
    const parsed = JSON.parse(payload) as { firstName?: string; lastName?: string };
    return [parsed.firstName, parsed.lastName].filter(Boolean).join(" ") || null;
  } catch {
    return null;
  }
}

export default async function ListsPage() {
  const session = await requireSession();
  const disabledReferencePacks = await getDisabledReferencePacks(
    session.workspaceId,
  );

  // Ces requêtes indépendantes sont exécutées en parallèle.
  const [lists, allContacts, listFields, proposals] = await Promise.all([
    db.sharedList.findMany({
      where: {
        workspaceId: session.workspaceId,
        OR: [
          { sourcePack: null },
          { sourcePack: { notIn: [...disabledReferencePacks] } },
        ],
      },
      orderBy: [{ isPublished: "desc" }, { createdAt: "desc" }],
      include: {
        items: {
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                title: true,
                institution: true,
                party: true,
                level: true,
                stance: true,
                email: true,
                avatarColor: true,
              },
            },
          },
          orderBy: { note: "asc" },
        },
      },
    }),
    db.contact.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: [{ lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: true,
        institution: true,
        party: true,
        level: true,
        stance: true,
        email: true,
        avatarColor: true,
      },
    }),
    // Attributs rattachés à une liste précise.
    db.customField.findMany({
      where: { workspaceId: session.workspaceId, NOT: { listId: null } },
      orderBy: { position: "asc" },
      select: {
        id: true,
        listId: true,
        label: true,
        values: { select: { contactId: true, value: true } },
      },
    }),
    session.role === "ADMIN"
      ? db.listChangeProposal.findMany({
          where: {
            workspaceId: session.workspaceId,
            status: "PENDING",
            list: {
              OR: [
                { sourcePack: null },
                { sourcePack: { notIn: [...disabledReferencePacks] } },
              ],
            },
          },
          orderBy: { createdAt: "asc" },
          take: 200,
          include: {
            list: { select: { name: true } },
            author: { select: { name: true } },
            contact: { select: { firstName: true, lastName: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const fieldsByList = new Map<string, typeof listFields>();
  const valuesByList = new Map<string, Record<string, string>>();
  for (const f of listFields) {
    if (!f.listId) continue;
    const arr = fieldsByList.get(f.listId) ?? [];
    arr.push(f);
    fieldsByList.set(f.listId, arr);
    const values = valuesByList.get(f.listId) ?? {};
    for (const value of f.values) {
      if (value.value) values[`${value.contactId}:${f.id}`] = value.value;
    }
    valuesByList.set(f.listId, values);
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Actyl" }, { label: "Listes partagées" }]}
        title="Listes de décideurs"
        description="Annuaires vérifiés et partageables avec votre équipe — ou publiés pour toute l'organisation."
      />
      <ListsView
        lists={lists.map((l) => ({
          id: l.id,
          name: l.name,
          description: l.description,
          isPublished: l.isPublished,
          sourcePack: l.sourcePack,
          items: l.items.map((i) => ({ itemId: i.id, contact: i.contact })),
          attributes: (fieldsByList.get(l.id) ?? []).map((f) => ({
            id: f.id,
            label: f.label,
          })),
          values: valuesByList.get(l.id) ?? {},
        }))}
        allContacts={allContacts}
        canManage={can(session.role, "list:create")}
        canPublish={can(session.role, "list:publish")}
        isAdmin={session.role === "ADMIN"}
        proposals={proposals.map((proposal) => ({
          id: proposal.id,
          action: proposal.action,
          listName: proposal.list.name,
          authorName: proposal.author?.name ?? "Synchronisation publique",
          contactName: proposal.contact
            ? `${proposal.contact.firstName} ${proposal.contact.lastName}`
            : proposalName(proposal.payload),
          createdAt: proposal.createdAt.toISOString(),
        }))}
      />
    </>
  );
}

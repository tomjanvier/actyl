import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { ListsView } from "@/components/lists/lists-view";
import { getDisabledReferencePacks } from "@/lib/reference-pack-settings";
import { getListShortcutIds } from "@/lib/list-shortcuts";

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
  const canCreateLists = can(session.role, "list:create");

  // Ces requêtes indépendantes sont exécutées en parallèle.
  const [lists, allContacts, listFields, listMemberships, proposals, shortcutIds] = await Promise.all([
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
          take: 5,
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
                photoUrl: true,
                avatarColor: true,
              },
            },
          },
          orderBy: { note: "asc" },
        },
        _count: { select: { items: true } },
      },
    }),
    canCreateLists
      ? db.contact.findMany({
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
            photoUrl: true,
            avatarColor: true,
          },
        })
      : Promise.resolve([]),
    // Attributs rattachés à une liste précise.
    db.customField.findMany({
      where: { workspaceId: session.workspaceId, NOT: { listId: null } },
      orderBy: { position: "asc" },
      select: { id: true, listId: true, label: true },
    }),
    canCreateLists
      ? db.listItem.findMany({
          where: {
            list: {
              workspaceId: session.workspaceId,
              OR: [
                { sourcePack: null },
                { sourcePack: { notIn: [...disabledReferencePacks] } },
              ],
            },
          },
          select: { listId: true, contactId: true },
        })
      : Promise.resolve([]),
    session.user.isSuperAdmin
      ? db.listChangeProposal.findMany({
          where: {
            status: "PENDING",
            list: { sourcePack: { not: null } },
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
    getListShortcutIds(session.workspaceId, session.user.id),
  ]);
  const shortcutSet = new Set(shortcutIds);

  const previewContactIds = lists.flatMap((list) =>
    list.items.map((item) => item.contact.id),
  );
  const listFieldValues = previewContactIds.length
    ? await db.customFieldValue.findMany({
        where: {
          contactId: { in: previewContactIds },
          field: { workspaceId: session.workspaceId, NOT: { listId: null } },
        },
        select: { fieldId: true, contactId: true, value: true },
      })
    : [];

  const fieldsByList = new Map<string, typeof listFields>();
  const valuesByList = new Map<string, Record<string, string>>();
  for (const f of listFields) {
    if (!f.listId) continue;
    const arr = fieldsByList.get(f.listId) ?? [];
    arr.push(f);
    fieldsByList.set(f.listId, arr);
    const values = valuesByList.get(f.listId) ?? {};
    valuesByList.set(f.listId, values);
  }
  const fieldToList = new Map(listFields.map((field) => [field.id, field.listId]));
  for (const value of listFieldValues) {
    const listId = fieldToList.get(value.fieldId);
    if (!listId || !value.value) continue;
    const values = valuesByList.get(listId) ?? {};
    values[`${value.contactId}:${value.fieldId}`] = value.value;
    valuesByList.set(listId, values);
  }
  const membersByList = new Map<string, string[]>();
  for (const membership of listMemberships) {
    const members = membersByList.get(membership.listId) ?? [];
    members.push(membership.contactId);
    membersByList.set(membership.listId, members);
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Actyl" }, { label: "Listes partagées" }]}
        title="Listes de décideurs"
        description="Annuaires vérifiés, réservés à votre équipe ou accessibles à toute personne disposant du lien."
      />
      <ListsView
        lists={lists.map((l) => {
          const ownsList = !l.sourcePack && l.createdById === session.user.id;
          const canEdit = l.sourcePack
            ? session.user.isSuperAdmin
            : session.role === "ADMIN" || ownsList;
          return {
            id: l.id,
            name: l.name,
            description: l.description,
            isPublished: l.isPublished,
            sourcePack: l.sourcePack,
            items: l.items.map((i) => ({ itemId: i.id, contact: i.contact })),
            totalItems: l._count.items,
            memberContactIds: membersByList.get(l.id) ?? [],
            pinned: shortcutSet.has(l.id),
            canEdit,
            canContribute:
              can(session.role, "list:create") &&
              (session.role === "ADMIN" || !!l.sourcePack || ownsList),
            canImport: l.sourcePack
              ? session.user.isSuperAdmin
              : session.role === "ADMIN" || ownsList,
            attributes: (fieldsByList.get(l.id) ?? []).map((f) => ({
              id: f.id,
              label: f.label,
            })),
            values: valuesByList.get(l.id) ?? {},
          };
        })}
        allContacts={allContacts}
        canManage={canCreateLists}
        canPublish={session.role === "ADMIN"}
        isAdmin={session.user.isSuperAdmin}
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

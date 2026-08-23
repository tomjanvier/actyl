import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { ListsView } from "@/components/lists/lists-view";

export const metadata = { title: "Listes partagées" };

export default async function ListsPage() {
  const session = await requireSession();

  // Both queries are independent — run them concurrently.
  const [lists, allContacts, listFields] = await Promise.all([
    db.sharedList.findMany({
      where: { workspaceId: session.workspaceId },
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
    // Attributes dedicated to a specific list.
    db.customField.findMany({
      where: { workspaceId: session.workspaceId, NOT: { listId: null } },
      orderBy: { position: "asc" },
      select: { id: true, listId: true, label: true },
    }),
  ]);

  const fieldIds = listFields.map((f) => f.id);
  const attrValues = fieldIds.length
    ? await db.customFieldValue.findMany({
        where: { fieldId: { in: fieldIds } },
        select: { contactId: true, fieldId: true, value: true },
      })
    : [];
  const valueMap: Record<string, string> = {};
  for (const v of attrValues) {
    if (v.value) valueMap[`${v.contactId}:${v.fieldId}`] = v.value;
  }
  const fieldsByList = new Map<string, typeof listFields>();
  for (const f of listFields) {
    if (!f.listId) continue;
    const arr = fieldsByList.get(f.listId) ?? [];
    arr.push(f);
    fieldsByList.set(f.listId, arr);
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
          items: l.items.map((i) => ({ itemId: i.id, contact: i.contact })),
          attributes: (fieldsByList.get(l.id) ?? []).map((f) => ({
            id: f.id,
            label: f.label,
          })),
          values: Object.fromEntries(
            Object.entries(valueMap).filter(([k]) =>
              (fieldsByList.get(l.id) ?? []).some((f) => k.endsWith(`:${f.id}`)),
            ),
          ),
        }))}
        allContacts={allContacts}
        canManage={can(session.role, "list:create")}
        canPublish={can(session.role, "list:publish")}
      />
    </>
  );
}

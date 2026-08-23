"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/constants";

export async function createListAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "list:create")) return { error: "Permission refusée" };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (name.length < 3) return { error: "Nom de liste trop court" };

  await db.sharedList.create({
    data: {
      workspaceId: session.workspaceId,
      name,
      description: description || null,
      createdById: session.user.id,
    },
  });
  revalidatePath("/lists");
  return { ok: true };
}

export async function toggleListPublishAction(listId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "list:publish")) throw new Error("Permission refusée");
  const list = await db.sharedList.findFirst({
    where: { id: listId, workspaceId: session.workspaceId },
  });
  if (!list) throw new Error("Liste introuvable");
  await db.sharedList.update({
    where: { id: listId },
    data: { isPublished: !list.isPublished },
  });
  revalidatePath("/lists");
}

export async function deleteListAction(listId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "list:edit")) throw new Error("Permission refusée");
  await db.sharedList.deleteMany({
    where: { id: listId, workspaceId: session.workspaceId },
  });
  revalidatePath("/lists");
}

export async function addContactsToListAction(input: {
  listId: string;
  contactIds: string[];
}) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "list:create")) throw new Error("Permission refusée");
  const list = await db.sharedList.findFirst({
    where: { id: input.listId, workspaceId: session.workspaceId },
  });
  if (!list) throw new Error("Liste introuvable");
  for (const contactId of input.contactIds) {
    await db.listItem.upsert({
      where: { listId_contactId: { listId: input.listId, contactId } },
      create: { listId: input.listId, contactId },
      update: {},
    });
  }
  revalidatePath("/lists");
}

export async function removeListItemAction(itemId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "list:edit")) throw new Error("Permission refusée");
  const item = await db.listItem.findFirst({
    where: { id: itemId, list: { workspaceId: session.workspaceId } },
  });
  if (!item) throw new Error("Élément introuvable");
  await db.listItem.delete({ where: { id: itemId } });
  revalidatePath("/lists");
}

// ── Dedicated list attributes (list-scoped custom fields) ────────────────────

export async function createListFieldAction(input: {
  listId: string;
  label: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "list:create")) return { error: "Permission refusée" };

  const list = await db.sharedList.findFirst({
    where: { id: input.listId, workspaceId: session.workspaceId },
    select: { id: true },
  });
  if (!list) return { error: "Liste introuvable" };

  const label = input.label.trim().slice(0, 60);
  if (label.length < 2) return { error: "Libellé trop court." };

  const name =
    "lf_" +
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);

  // Names are workspace-unique; suffix on collision.
  const clash = await db.customField.findFirst({
    where: { workspaceId: session.workspaceId, name },
    select: { id: true },
  });
  const finalName = clash ? `${name}_${Date.now().toString(36)}` : name;

  const position = await db.customField.count({
    where: { workspaceId: session.workspaceId, listId: input.listId },
  });

  await db.customField.create({
    data: {
      workspaceId: session.workspaceId,
      listId: input.listId,
      name: finalName,
      label,
      type: "TEXT",
      showInTable: false,
      position,
    },
  });
  revalidatePath("/lists");
  return { ok: true };
}

export async function deleteListFieldAction(fieldId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "list:create")) throw new Error("Permission refusée");
  await db.customField.deleteMany({
    where: { id: fieldId, workspaceId: session.workspaceId, NOT: { listId: null } },
  });
  revalidatePath("/lists");
}

export async function setListItemAttrAction(input: {
  listId: string;
  contactId: string;
  fieldId: string;
  value: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "list:edit")) throw new Error("Permission refusée");

  const field = await db.customField.findFirst({
    where: {
      id: input.fieldId,
      workspaceId: session.workspaceId,
      listId: input.listId,
    },
    select: { id: true },
  });
  if (!field) throw new Error("Attribut introuvable");

  const inList = await db.listItem.findFirst({
    where: { listId: input.listId, contactId: input.contactId },
    select: { id: true },
  });
  if (!inList) throw new Error("Contact absent de la liste");

  const value = input.value.trim().slice(0, 300);
  await db.customFieldValue.upsert({
    where: { fieldId_contactId: { fieldId: field.id, contactId: input.contactId } },
    create: { fieldId: field.id, contactId: input.contactId, value: value || null },
    update: { value: value || null },
  });
  revalidatePath("/lists");
}

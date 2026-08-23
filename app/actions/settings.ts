"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { can, ROLES, type Role } from "@/lib/constants";

// ── Custom fields ────────────────────────────────────────────────────────────

const fieldSchema = z.object({
  label: z.string().min(2, "Libellé requis").max(80),
  type: z.enum([
    "TEXT", "SELECT", "MULTI_SELECT", "NUMBER", "DATE", "RATING", "BOOLEAN", "URL",
  ]),
  options: z.string().optional().or(z.literal("")),
  description: z.string().max(300).optional().or(z.literal("")),
});

export async function createCustomFieldAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (session.role !== "ADMIN") return { error: "Réservé aux administrateurs" };

  const parsed = fieldSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  const d = parsed.data;

  const needsOptions = d.type === "SELECT" || d.type === "MULTI_SELECT";
  const options = needsOptions
    ? d.options
        ?.split(/[,\n]/)
        .map((o) => o.trim())
        .filter(Boolean) ?? []
    : [];
  if (needsOptions && options.length < 2)
    return { error: "Au moins 2 options sont requises pour ce type" };

  const name =
    "cf_" +
    d.label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
  const existing = await db.customField.findFirst({
    where: { workspaceId: session.workspaceId, name },
  });
  if (existing) return { error: "Un champ similaire existe déjà" };

  const count = await db.customField.count({
    where: { workspaceId: session.workspaceId },
  });
  await db.customField.create({
    data: {
      workspaceId: session.workspaceId,
      name,
      label: d.label,
      type: d.type,
      options: options.length ? JSON.stringify(options) : null,
      description: d.description || null,
      position: count,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/contacts");
  return { ok: true };
}

export async function deleteCustomFieldAction(fieldId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (session.role !== "ADMIN") throw new Error("Réservé aux administrateurs");
  await db.customField.deleteMany({
    where: { id: fieldId, workspaceId: session.workspaceId },
  });
  revalidatePath("/settings");
  revalidatePath("/contacts");
}

// ── Groups / squads ──────────────────────────────────────────────────────────

export async function createGroupAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "campaign:create"))
    return { error: "Permission refusée" };
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const color = String(formData.get("color") ?? "indigo");
  if (name.length < 3) return { error: "Nom de groupe trop court" };

  await db.group.create({
    data: {
      workspaceId: session.workspaceId,
      name,
      description: description || null,
      color,
    },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteGroupAction(groupId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (session.role !== "ADMIN") throw new Error("Réservé aux administrateurs");
  await db.group.deleteMany({
    where: { id: groupId, workspaceId: session.workspaceId },
  });
  revalidatePath("/settings");
}

export async function addMembershipToGroupAction(input: {
  groupId: string;
  membershipId: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (session.role !== "ADMIN") throw new Error("Réservé aux administrateurs");
  await db.groupMember.upsert({
    where: {
      groupId_membershipId: { groupId: input.groupId, membershipId: input.membershipId },
    },
    create: { groupId: input.groupId, membershipId: input.membershipId },
    update: {},
  });
  revalidatePath("/settings");
}

export async function removeGroupMemberAction(groupMemberId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (session.role !== "ADMIN") throw new Error("Réservé aux administrateurs");
  await db.groupMember.deleteMany({ where: { id: groupMemberId } });
  revalidatePath("/settings");
}

// ── Members & roles ──────────────────────────────────────────────────────────

export async function updateMemberRoleAction(
  membershipId: string,
  role: Role,
): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (session.role !== "ADMIN") return { error: "Réservé aux administrateurs" };
  if (!ROLES.includes(role)) return { error: "Rôle invalide" };
  const membership = await db.membership.findFirst({
    where: { id: membershipId, workspaceId: session.workspaceId },
  });
  if (!membership) return { error: "Membre introuvable" };
  if (membership.userId === session.user.id && role !== "ADMIN")
    return { error: "Vous ne pouvez pas retirer votre propre rôle admin." };
  await db.membership.update({ where: { id: membershipId }, data: { role } });
  revalidatePath("/settings");
  return { ok: true };
}

export async function inviteMemberAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (session.role !== "ADMIN") return { error: "Réservé aux administrateurs" };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "MEMBER") as Role;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Email invalide." };
  if (name.length < 2) return { error: "Nom requis." };
  if (password.length < 8) return { error: "Mot de passe : 8 caractères minimum." };
  if (!ROLES.includes(role)) return { error: "Rôle invalide." };

  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({
      data: { email, name, passwordHash: await hashPassword(password) },
    });
  }
  const existingMembership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: session.workspaceId } },
  });
  if (existingMembership) return { error: "Cette personne fait déjà partie de l'espace." };

  await db.membership.create({
    data: { userId: user.id, workspaceId: session.workspaceId, role },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeMemberAction(membershipId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (session.role !== "ADMIN") throw new Error("Réservé aux administrateurs");
  const membership = await db.membership.findFirst({
    where: { id: membershipId, workspaceId: session.workspaceId },
  });
  if (!membership) throw new Error("Membre introuvable");
  if (membership.userId === session.user.id)
    throw new Error("Vous ne pouvez pas vous retirer vous-même.");
  await db.membership.delete({ where: { id: membershipId } });
  revalidatePath("/settings");
}

// ── Profile ──────────────────────────────────────────────────────────────────

export async function updateProfileAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  const name = String(formData.get("name") ?? "").trim();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  if (name.length < 2) return { error: "Nom trop court" };

  const data: { name: string; jobTitle: string | null; passwordHash?: string } = {
    name,
    jobTitle: jobTitle || null,
  };
  if (newPassword) {
    if (newPassword.length < 8)
      return { error: "Nouveau mot de passe : 8 caractères minimum." };
    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user) return { error: "Utilisateur introuvable" };
    if (!(await verifyPassword(currentPassword, user.passwordHash)))
      return { error: "Mot de passe actuel incorrect." };
    data.passwordHash = await hashPassword(newPassword);
  }
  await db.user.update({ where: { id: session.user.id }, data });
  revalidatePath("/settings");
  return { ok: true };
}

// ── Account requests (gated signups) ─────────────────────────────────────────

export async function setSignupModeAction(mode: "OPEN" | "APPROVAL") {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (session.role !== "ADMIN") throw new Error("Réservé aux administrateurs");
  const { setSignupMode } = await import("@/lib/signup-mode");
  await setSignupMode(mode);
  revalidatePath("/settings");
}

export async function approveAccountRequestAction(requestId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (session.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  const req = await db.accountRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== "PENDING") throw new Error("Demande introuvable");

  let user = await db.user.findUnique({ where: { email: req.email } });
  if (!user) {
    user = await db.user.create({
      data: {
        email: req.email,
        name: req.name,
        passwordHash: req.passwordHash,
      },
    });
  }

  let slug = req.orgName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 50) || `org-${Date.now()}`;
  if (await db.workspace.findUnique({ where: { slug } })) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  await db.workspace.create({
    data: {
      name: req.orgName,
      slug,
      website: req.website,
      phone: req.phone,
      memberships: { create: { userId: user.id, role: "ADMIN" } },
    },
  });

  await db.accountRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED" },
  });
  revalidatePath("/settings");
}

export async function rejectAccountRequestAction(requestId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (session.role !== "ADMIN") throw new Error("Réservé aux administrateurs");
  await db.accountRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED" },
  });
  revalidatePath("/settings");
}

// ── API tokens (WordPress / external integrations) ───────────────────────────

export async function createApiTokenAction(input: {
  name: string;
}): Promise<{ error?: string; ok?: boolean; plaintext?: string; prefix?: string }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (session.role !== "ADMIN") return { error: "Réservé aux administrateurs" };

  const name = input.name.trim().slice(0, 60);
  if (name.length < 2) return { error: "Nom du token requis" };

  const count = await db.apiToken.count({
    where: { workspaceId: session.workspaceId, revokedAt: null },
  });
  if (count >= 10) return { error: "Maximum 10 tokens actifs. Révoquez-en un d'abord." };

  const { generateApiToken } = await import("@/lib/api");
  const { plaintext, hash, prefix } = generateApiToken();
  await db.apiToken.create({
    data: { workspaceId: session.workspaceId, name, tokenHash: hash, prefix },
  });
  revalidatePath("/settings");
  // Plaintext is returned exactly once — only the hash is stored server-side.
  return { ok: true, plaintext, prefix };
}

export async function revokeApiTokenAction(tokenId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (session.role !== "ADMIN") throw new Error("Réservé aux administrateurs");
  await db.apiToken.updateMany({
    where: { id: tokenId, workspaceId: session.workspaceId },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/settings");
}

// ── Extended directory flag (members/volunteers/donors/supporters) ───────────

export async function setExtendedDirectoryAction(enabled: boolean) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (session.role !== "ADMIN") throw new Error("Réservé aux administrateurs");
  await db.appSetting.upsert({
    where: { key: "extended_directory" },
    create: { key: "extended_directory", value: enabled ? "on" : "off" },
    update: { value: enabled ? "on" : "off" },
  });
  revalidatePath("/settings");
  revalidatePath("/contacts");
}

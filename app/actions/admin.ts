"use server";
import { db } from "@/lib/db";
import { requireSession, setWorkspaceCookie } from "@/lib/auth";
import { redirect } from "next/navigation";

/** Deliberate entry into a workspace, with an explicit administrator membership. */
export async function enterAdminWorkspaceAction(formData: FormData) {
  const session = await requireSession();
  if (!session.user.isSuperAdmin)
    throw new Error("Réservé au super-administrateur");
  const id = String(formData.get("workspaceId") ?? "");
  const workspace = await db.workspace.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!workspace) throw new Error("Espace introuvable");
  await db.membership.upsert({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: id } },
    create: { userId: session.user.id, workspaceId: id, role: "ADMIN" },
    update: { role: "ADMIN" },
  });
  await setWorkspaceCookie(id);
  redirect("/settings?tab=membres");
}

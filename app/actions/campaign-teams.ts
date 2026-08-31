"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/constants";

export type CampaignTeamActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
};

const positionSchema = z.object({
  teamId: z.string().trim().min(1),
  groupId: z.string().trim().min(1),
  topic: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(3).max(2_000),
  stance: z.enum(["FAVORABLE", "MIXED", "OPPOSED", "UNKNOWN"]),
});

export async function createPoliticalPositionAction(
  _state: CampaignTeamActionState | undefined,
  formData: FormData,
): Promise<CampaignTeamActionState> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "note:add")) return { error: "Permission refusée" };
  try {
    const parsed = positionSchema.parse(Object.fromEntries(formData));
    const [team, group] = await Promise.all([
      db.campaignTeam.findFirst({
        where: {
          id: parsed.teamId,
          workspaceId: session.workspaceId,
          list: { sourcePack: "presidentielle-2027" },
        },
        select: { id: true },
      }),
      db.group.findFirst({
        where: {
          id: parsed.groupId,
          workspaceId: session.workspaceId,
          ...(session.role === "ADMIN"
            ? {}
            : { members: { some: { membership: { userId: session.user.id } } } }),
        },
        select: { id: true },
      }),
    ]);
    if (!team) return { error: "Équipe de candidature introuvable" };
    if (!group) return { error: "Équipe de travail inaccessible" };
    await db.politicalPosition.create({
      data: {
        workspaceId: session.workspaceId,
        teamId: team.id,
        groupId: group.id,
        authorId: session.user.id,
        topic: parsed.topic,
        summary: parsed.summary,
        stance: parsed.stance,
        sourceKey: crypto.randomUUID(),
      },
    });
    revalidatePath("/presidentielle");
    return { ok: true, message: "Piste de travail partagée avec l’équipe" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enregistrement impossible" };
  }
}

const programSchema = z.object({
  teamId: z.string().trim().min(1),
  programUrl: z.string().trim().url().optional().or(z.literal("")),
});

/** Met à jour le lien unique vers le programme officiel d'une candidature. */
export async function updateCampaignProgramAction(input: {
  teamId: string;
  programUrl: string;
}) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    throw new Error("Action réservée à l’administrateur");
  }
  const parsed = programSchema.parse(input);
  const team = await db.campaignTeam.findFirst({
    where: {
      id: parsed.teamId,
      workspaceId: session.workspaceId,
      list: { sourcePack: "presidentielle-2027" },
    },
    select: { id: true },
  });
  if (!team) throw new Error("Équipe de candidature introuvable");
  await db.campaignTeam.update({
    where: { id: team.id },
    data: { programUrl: parsed.programUrl || null },
  });
  revalidatePath("/presidentielle");
  return { ok: true };
}

/** Supprime une note de position créée par l'utilisateur ou administrée. */
export async function deletePoliticalPositionAction(positionId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  const position = await db.politicalPosition.findFirst({
    where: {
      id: positionId,
      workspaceId: session.workspaceId,
      ...(session.role === "ADMIN" ? {} : { authorId: session.user.id }),
    },
    select: { id: true },
  });
  if (!position) throw new Error("Piste introuvable ou non modifiable");
  await db.politicalPosition.delete({ where: { id: position.id } });
  revalidatePath("/presidentielle");
  return { ok: true };
}

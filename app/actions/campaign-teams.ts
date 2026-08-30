"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { importCampaignTeamsCsv } from "@/lib/campaign-team-import";

export type CampaignTeamActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export async function importCampaignTeamsAction(
  _state: CampaignTeamActionState | undefined,
  formData: FormData,
): Promise<CampaignTeamActionState> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "Action réservée à l’administrateur" };
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Sélectionnez un fichier CSV" };
  if (file.size > 4_000_000) return { error: "Le fichier dépasse la limite de 4 Mo" };

  try {
    const result = await importCampaignTeamsCsv(
      session.workspaceId,
      await file.text(),
      `CSV administrateur — ${new Date().toLocaleDateString("fr-FR")}`,
    );
    revalidatePath("/campaign-teams");
    revalidatePath("/contacts");
    return {
      ok: true,
      message: `${result.teams} équipes, ${result.members} rattachements et ${result.positions} positions importés.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Import impossible" };
  }
}

const positionSchema = z.object({
  teamId: z.string().trim().optional(),
  party: z.string().trim().max(120).optional(),
  topic: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(3).max(2_000),
  stance: z.enum(["FAVORABLE", "MIXED", "OPPOSED", "UNKNOWN"]),
  sourceLabel: z.string().trim().min(2).max(160),
  sourceUrl: z.string().trim().url().optional().or(z.literal("")),
});

export async function createPoliticalPositionAction(
  _state: CampaignTeamActionState | undefined,
  formData: FormData,
): Promise<CampaignTeamActionState> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "Action réservée à l’administrateur" };
  try {
    const parsed = positionSchema.parse(Object.fromEntries(formData));
    if (!parsed.teamId && !parsed.party) return { error: "Choisissez une équipe ou renseignez un parti" };
    if (parsed.teamId) {
      const team = await db.campaignTeam.findFirst({
        where: { id: parsed.teamId, workspaceId: session.workspaceId },
        select: { id: true },
      });
      if (!team) return { error: "Équipe introuvable" };
    }
    await db.politicalPosition.create({
      data: {
        workspaceId: session.workspaceId,
        teamId: parsed.teamId || null,
        party: parsed.party || null,
        topic: parsed.topic,
        summary: parsed.summary,
        stance: parsed.stance,
        sourceLabel: parsed.sourceLabel,
        sourceUrl: parsed.sourceUrl || null,
        sourceKey: crypto.randomUUID(),
      },
    });
    revalidatePath("/campaign-teams");
    return { ok: true, message: "Position ajoutée" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enregistrement impossible" };
  }
}

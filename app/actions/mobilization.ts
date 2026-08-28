"use server";

/**
 * Suite de mobilisation : pétitions publiques, événements avec inscription,
 * tâches de suivi et registre partagé des soutiens. Les actions publiques sont
 * limitées en fréquence.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { upsertSupporter } from "@/lib/supporters";

// Limites strictes contre le gonflement de la base par les formulaires publics.
const MAX_NAME = 80;
const MAX_CITY = 80;

// ── Petitions ────────────────────────────────────────────────────────────────

const petitionSchema = z.object({
  title: z.string().min(4, "Titre requis").max(160),
  description: z.string().min(20, "Description trop courte (20 caractères min.)").max(4000),
  goal: z.coerce.number().int().min(10).max(1_000_000),
});

export async function savePetitionAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "email:send")) return { error: "Permission refusée" };

  const campaignId = String(formData.get("campaignId") ?? "");
  const parsed = petitionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };

  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspaceId: session.workspaceId },
    select: { id: true },
  });
  if (!campaign) return { error: "Campagne introuvable" };

  await db.petition.upsert({
    where: { campaignId },
    create: { ...parsed.data, workspaceId: session.workspaceId, campaignId },
    update: {
      title: parsed.data.title,
      description: parsed.data.description,
      goal: parsed.data.goal,
    },
  });
  revalidatePath(`/campaigns/${campaignId}/mobilization`);
  return { ok: true };
}

export async function togglePetitionPublishAction(petitionId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "email:send")) throw new Error("Permission refusée");
  const petition = await db.petition.findFirst({
    where: { id: petitionId, workspaceId: session.workspaceId },
  });
  if (!petition) throw new Error("Pétition introuvable");
  await db.petition.update({
    where: { id: petitionId },
    data: { isPublished: !petition.isPublished },
  });
  revalidatePath(`/campaigns/${petition.campaignId}/mobilization`);
}

export async function citizenSignAction(input: {
  campaignSlug: string;
  name: string;
  email: string;
  city?: string;
}): Promise<
  | { ok: true; count: number }
  | { error: string }
> {
  const name = input.name.trim().slice(0, MAX_NAME);
  const email = input.email.trim().toLowerCase().slice(0, 200);
  const city = input.city?.trim().slice(0, MAX_CITY);
  if (name.length < 2) return { error: "Votre nom est requis." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Adresse email invalide." };

  // Anti-abuse: 10 signatures per minute per IP
  const rl = rateLimit(`petition-sign:${await clientIp()}`, 10);
  if (!rl.allowed)
    return { error: `Trop de tentatives. Réessayez dans ${rl.retryAfterSec}s.` };

  const petition = await db.petition.findFirst({
    where: {
      isPublished: true,
      campaign: { slug: input.campaignSlug },
    },
    select: { id: true, workspaceId: true },
  });
  if (!petition) return { error: "Pétition introuvable ou non publiée." };

  await db.petitionSignature.upsert({
    where: { petitionId_email: { petitionId: petition.id, email } },
    create: { petitionId: petition.id, name, email, city: city || null },
    update: { name, city: city || null },
  });

  await upsertSupporter({
    email,
    name,
    city: city || undefined,
    workspaceId: petition.workspaceId,
    source: "petition",
  });
  const count = await db.petitionSignature.count({ where: { petitionId: petition.id } });
  return { ok: true, count };
}

// ── Events ───────────────────────────────────────────────────────────────────

export async function createEventAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "campaign:create")) return { error: "Permission refusée" };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const startsAtRaw = String(formData.get("startsAt") ?? "");
  const durationH = Number(formData.get("durationHours") ?? "2");
  if (title.length < 3) return { error: "Titre requis" };
  if (!startsAtRaw) return { error: "Date et heure requises" };
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) return { error: "Date invalide" };

  await db.event.create({
    data: {
      workspaceId: session.workspaceId,
      title,
      description: description || null,
      location: location || null,
      startsAt,
      endsAt: new Date(startsAt.getTime() + Math.max(durationH, 0.5) * 3600 * 1000),
    },
  });
  revalidatePath("/events");
  return { ok: true };
}

export async function toggleEventPublishAction(eventId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "campaign:create")) throw new Error("Permission refusée");
  const event = await db.event.findFirst({
    where: { id: eventId, workspaceId: session.workspaceId },
  });
  if (!event) throw new Error("Événement introuvable");
  await db.event.update({
    where: { id: eventId },
    data: { isPublished: !event.isPublished },
  });
  revalidatePath("/events");
}

export async function deleteEventAction(eventId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "campaign:delete")) throw new Error("Permission refusée");
  await db.event.deleteMany({
    where: { id: eventId, workspaceId: session.workspaceId },
  });
  revalidatePath("/events");
}

export async function rsvpEventAction(input: {
  eventId: string;
  name: string;
  email: string;
  response: "YES" | "NO" | "MAYBE";
}): Promise<{ ok?: boolean; error?: string }> {
  // Anti-abuse: 10 RSVPs per minute per IP.
  const rl = rateLimit(`rsvp:${await clientIp()}`, 10);
  if (!rl.allowed)
    return { error: `Trop de tentatives. Réessayez dans ${rl.retryAfterSec}s.` };

  const name = input.name.trim().slice(0, MAX_NAME);
  const email = input.email.trim().toLowerCase().slice(0, 200);
  if (name.length < 2) return { error: "Nom requis." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Email invalide." };
  const response =
    input.response === "NO" || input.response === "MAYBE" ? input.response : "YES";
  const event = await db.event.findFirst({
    where: { id: input.eventId, isPublished: true },
  });
  if (!event) return { error: "Événement introuvable." };
  await db.eventRsvp.upsert({
    where: { eventId_email: { eventId: input.eventId, email } },
    create: { eventId: input.eventId, name, email, response },
    update: { name, response },
  });

  await upsertSupporter({
    email,
    name,
    workspaceId: event.workspaceId,
    source: "event",
  });
  return { ok: true };
}

// ── Tasks / follow-ups ───────────────────────────────────────────────────────

export async function createTaskAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (session.role === "OBSERVER") return { error: "Permission refusée" };

  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const contactId = String(formData.get("contactId") ?? "");
  const dueDateRaw = String(formData.get("dueDate") ?? "");
  const assignedToId = String(formData.get("assignedToId") ?? "");
  if (title.length < 3) return { error: "Intitulé requis" };

  await db.task.create({
    data: {
      workspaceId: session.workspaceId,
      title,
      notes: notes || null,
      contactId: contactId || null,
      assignedToId: assignedToId || session.user.id,
      createdById: session.user.id,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
    },
  });
  revalidatePath("/tasks");
  return { ok: true };
}

export async function toggleTaskDoneAction(taskId: string, done: boolean) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  const task = await db.task.findFirst({
    where: { id: taskId, workspaceId: session.workspaceId },
  });
  if (!task) throw new Error("Tâche introuvable");
  await db.task.update({ where: { id: taskId }, data: { done } });
  revalidatePath("/tasks");
}

export async function deleteTaskAction(taskId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  const task = await db.task.findFirst({
    where: { id: taskId, workspaceId: session.workspaceId },
  });
  if (!task) throw new Error("Tâche introuvable");
  await db.task.delete({ where: { id: taskId } });
  revalidatePath("/tasks");
}

// ── Segmentation des soutiens par étiquettes ──────────────────────────────────

export async function setSupporterTagsAction(input: {
  supporterId: string;
  tags: string[];
}): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  // Seuls les rôles opérationnels gèrent la base des soutiens.
  if (!can(session.role, "contact:create")) return { error: "Permission refusée" };

  const supporter = await db.supporter.findFirst({
    where: {
      id: input.supporterId,
      workspaceId: session.workspaceId,
    },
  });
  if (!supporter) return { error: "Soutien introuvable." };

  // Nettoie, déduplique et limite à douze tags de vingt-quatre caractères.
  const tags = [
    ...new Set(
      input.tags
        .map((t) => t.trim().slice(0, 24))
        .filter((t) => t.length > 0),
    ),
  ].slice(0, 12);

  await db.supporter.update({
    where: { id: supporter.id },
    data: { tags: tags.length ? tags.join(",") : null },
  });
  revalidatePath("/supporters");
  return { ok: true };
}

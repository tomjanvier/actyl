"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createFeedbackIssue } from "@/lib/feedback-github";
import { createResolveHQTicket } from "@/lib/feedback-resolvehq";
import { dispatchEmail, wrapEmailHtml } from "@/lib/email";
import { revalidatePath } from "next/cache";

const reportSchema = z.object({
  category: z.enum(["BUG", "QUESTION", "IDEA", "OTHER"]),
  title: z.string().trim().min(8, "Donne un titre un peu plus précis.").max(140),
  description: z.string().trim().min(20, "Décris le problème en quelques mots.").max(3000),
  expected: z.string().trim().max(1500).optional().or(z.literal("")),
  observed: z.string().trim().max(1500).optional().or(z.literal("")),
  steps: z.string().trim().max(2000).optional().or(z.literal("")),
  pagePath: z.string().trim().max(180).optional().or(z.literal("")),
  deviceInfo: z.string().max(1200).optional().or(z.literal("")),
  website: z.string().max(0).optional(),
});

async function hashReport(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safePagePath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  const path = value.split(/[?#]/, 1)[0] ?? "/";
  return path.split("/").map((segment) => segment.length > 24 ? ":id" : segment).join("/").slice(0, 180);
}

function isActionableBug(report: {
  category: string;
  description: string;
  expected: string | null;
  observed: string | null;
  steps: string | null;
}) {
  return report.category === "BUG" &&
    report.description.length >= 30 &&
    (report.expected?.length ?? 0) >= 10 &&
    (report.observed?.length ?? 0) >= 10 &&
    (report.steps?.length ?? 0) >= 20;
}

export async function submitFeedbackReport(formData: FormData): Promise<{
  error?: string;
  ok?: boolean;
  reference?: string;
  githubCreated?: boolean;
  githubPending?: boolean;
}> {
  const session = await getSession();
  if (!session) return { error: "Reconnecte-toi pour envoyer un signalement." };

  const parsed = reportSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Vérifie les champs du formulaire." };
  if (parsed.data.website) return { ok: true, reference: "reçu" };

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await db.feedbackReport.count({
    where: { workspaceId: session.workspaceId, userId: session.user.id, createdAt: { gte: since } },
  });
  if (recentCount >= 5) return { error: "Tu as envoyé plusieurs signalements récemment. Réessaie dans un moment." };

  const values = parsed.data;
  const expected = values.expected?.trim() || null;
  const observed = values.observed?.trim() || null;
  const steps = values.steps?.trim() || null;
  const pagePath = safePagePath(values.pagePath);
  const contentHash = await hashReport([
    values.category,
    values.title.toLocaleLowerCase("fr"),
    values.description.toLocaleLowerCase("fr"),
    expected?.toLocaleLowerCase("fr") ?? "",
    observed?.toLocaleLowerCase("fr") ?? "",
    steps?.toLocaleLowerCase("fr") ?? "",
  ].join("\n"));

  const duplicate = await db.feedbackReport.findUnique({
    where: { workspaceId_contentHash: { workspaceId: session.workspaceId, contentHash } },
    select: { id: true, githubIssueUrl: true, githubSyncState: true },
  });
  if (duplicate) {
    return {
      ok: true,
      reference: duplicate.id.slice(-8).toUpperCase(),
      githubCreated: duplicate.githubSyncState === "CREATED",
      githubPending: duplicate.githubSyncState === "PENDING" || duplicate.githubSyncState === "FAILED",
    };
  }

  const actionable = isActionableBug({
    category: values.category,
    description: values.description,
    expected,
    observed,
    steps,
  });
  const report = await db.feedbackReport.create({
    data: {
      workspaceId: session.workspaceId,
      userId: session.user.id,
      category: values.category,
      title: values.title,
      description: values.description,
      expected,
      observed,
      steps,
      pagePath,
      deviceInfo: values.deviceInfo || null,
      contentHash,
      githubSyncState: actionable ? "PENDING" : "NOT_ELIGIBLE",
      githubSyncNote: actionable ? null : "Requires a complete, reproducible bug report.",
    },
    select: { id: true, title: true, description: true, expected: true, observed: true, steps: true, pagePath: true },
  });
  revalidatePath("/admin/support");

  const resolvehq = await createResolveHQTicket({
    ...report, category: values.category, deviceInfo: values.deviceInfo || null,
    userName: session.user.name, userEmail: session.user.email,
  });
  await db.feedbackReport.update({
    where: { id: report.id },
    data: { resolvehqSyncState: resolvehq.state, resolvehqSyncNote: resolvehq.state === "CREATED" ? null : resolvehq.note, ...(resolvehq.state === "CREATED" ? { resolvehqTicketId: resolvehq.id, resolvehqTicketUrl: resolvehq.url } : {}) },
  });

  if (!actionable) return { ok: true, reference: report.id.slice(-8).toUpperCase() };

  const issue = await createFeedbackIssue(report);
  await db.feedbackReport.update({
    where: { id: report.id },
    data: {
      githubSyncState: issue.state,
      githubSyncNote: issue.state === "CREATED" ? null : issue.note,
      ...(issue.state === "CREATED"
        ? { githubIssueNumber: issue.number, githubIssueUrl: issue.url }
        : {}),
    },
  });

  return {
    ok: true,
    reference: report.id.slice(-8).toUpperCase(),
    githubCreated: issue.state === "CREATED",
    githubPending: issue.state !== "CREATED",
  };
}

export async function resolveFeedbackReportAction(reportId: string): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié." };
  if (session.role !== "ADMIN" && !session.user.isSuperAdmin) return { error: "Permission refusée." };
  const result = await db.feedbackReport.updateMany({
    where: {
      id: reportId,
      ...(session.user.isSuperAdmin ? {} : { workspaceId: session.workspaceId }),
      status: "OPEN",
    },
    data: { status: "RESOLVED" },
  });
  if (result.count !== 1) return { error: "Ce ticket est introuvable ou déjà traité." };
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function retryFeedbackIssueAction(reportId: string): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié." };
  if (session.role !== "ADMIN" && !session.user.isSuperAdmin) return { error: "Permission refusée." };
  const report = await db.feedbackReport.findFirst({
    where: {
      id: reportId,
      ...(session.user.isSuperAdmin ? {} : { workspaceId: session.workspaceId }),
      category: "BUG",
      githubIssueUrl: null,
    },
    select: { id: true, title: true, description: true, expected: true, observed: true, steps: true, pagePath: true },
  });
  if (!report || !isActionableBug({
    category: "BUG",
    description: report.description,
    expected: report.expected,
    observed: report.observed,
    steps: report.steps,
  })) return { error: "Ce ticket n’est pas éligible à la création d’une issue." };

  const issue = await createFeedbackIssue(report);
  await db.feedbackReport.update({
    where: { id: report.id },
    data: {
      githubSyncState: issue.state,
      githubSyncNote: issue.state === "CREATED" ? null : issue.note,
      ...(issue.state === "CREATED" ? { githubIssueNumber: issue.number, githubIssueUrl: issue.url } : {}),
    },
  });
  revalidatePath("/admin/support");
  return issue.state === "CREATED" ? { ok: true } : { error: issue.note };
}

export async function createFeedbackIssueAction(reportId: string): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié." };
  if (session.role !== "ADMIN" && !session.user.isSuperAdmin) return { error: "Permission refusée." };
  const report = await db.feedbackReport.findFirst({
    where: { id: reportId, ...(session.user.isSuperAdmin ? {} : { workspaceId: session.workspaceId }), category: "BUG", githubIssueUrl: null },
    select: { id: true, title: true, description: true, expected: true, observed: true, steps: true, pagePath: true },
  });
  if (!report) return { error: "Ce ticket est introuvable ou possède déjà une issue." };
  await db.feedbackReport.update({ where: { id: report.id }, data: { githubSyncState: "PENDING", githubSyncNote: null } });
  const issue = await createFeedbackIssue(report);
  await db.feedbackReport.update({
    where: { id: report.id },
    data: { githubSyncState: issue.state, githubSyncNote: issue.state === "CREATED" ? null : issue.note,
      ...(issue.state === "CREATED" ? { githubIssueNumber: issue.number, githubIssueUrl: issue.url } : {}) },
  });
  revalidatePath("/admin/support");
  return issue.state === "CREATED" ? { ok: true } : { error: issue.note };
}

export async function syncResolveHQTicketAction(reportId: string): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié." };
  if (session.role !== "ADMIN" && !session.user.isSuperAdmin) return { error: "Permission refusée." };
  const report = await db.feedbackReport.findFirst({
    where: { id: reportId, ...(session.user.isSuperAdmin ? {} : { workspaceId: session.workspaceId }), resolvehqTicketId: null },
    select: { id: true, category: true, title: true, description: true, expected: true, observed: true, steps: true, pagePath: true, deviceInfo: true, user: { select: { name: true, email: true } } },
  });
  if (!report?.user?.email) return { error: "Signalement introuvable ou adresse e-mail manquante." };
  const result = await createResolveHQTicket({ ...report, userName: report.user.name, userEmail: report.user.email });
  await db.feedbackReport.update({ where: { id: report.id }, data: { resolvehqSyncState: result.state, resolvehqSyncNote: result.state === "CREATED" ? null : result.note, ...(result.state === "CREATED" ? { resolvehqTicketId: result.id, resolvehqTicketUrl: result.url } : {}) } });
  revalidatePath("/admin/support");
  return result.state === "CREATED" ? { ok: true } : { error: result.note };
}

export async function replyFeedbackReportAction(reportId: string, message: string): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié." };
  if (session.role !== "ADMIN" && !session.user.isSuperAdmin) return { error: "Permission refusée." };
  const body = message.trim();
  if (body.length < 3 || body.length > 4000) return { error: "La réponse doit contenir entre 3 et 4 000 caractères." };
  if (!process.env.RESEND_API_KEY?.trim()) return { error: "L’envoi des e-mails n’est pas configuré (RESEND_API_KEY manquant)." };
  const report = await db.feedbackReport.findFirst({
    where: { id: reportId, ...(session.user.isSuperAdmin ? {} : { workspaceId: session.workspaceId }) },
    select: { id: true, title: true, user: { select: { email: true, name: true } }, workspace: { select: { name: true } } },
  });
  if (!report?.user?.email) return { error: "Aucune adresse e-mail n’est associée au compte auteur." };
  const result = await dispatchEmail({
    to: report.user.email,
    subject: `Réponse à ton signalement Actyl : ${report.title.slice(0, 100)}`,
    html: wrapEmailHtml(body, `${session.user.name} · équipe Actyl`, null, {
      greeting: `Bonjour ${report.user.name}, voici une réponse à ton signalement « ${report.title} ».`,
      workspaceName: report.workspace.name,
    }),
  });
  if (!result.ok || result.simulated) return { error: result.ok ? "L’e-mail n’a pas été envoyé : mode simulé." : `Échec de l’envoi : ${result.error}` };
  await db.feedbackReport.update({ where: { id: report.id }, data: { lastReplyAt: new Date(), lastReplyById: session.user.id, lastReplyMessage: body } });
  revalidatePath("/admin/support");
  return { ok: true };
}

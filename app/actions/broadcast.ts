"use server";

/**
 * Envoi groupé vers la base des soutiens, filtrée par source ou étiquette et
 * strictement limitée à l'espace de l'appelant. Le pipeline est commun avec le
 * moteur d'interpellation, via Resend ou le mode simulé.
 */

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { dispatchEmail } from "@/lib/email";

const MAX_BATCH = 500;
const MAX_SUBJECT = 200;
const MAX_BODY = 8000;

export type BroadcastAudience = {
  /** Filtre par première source, par exemple « newsletter » ou « petition ». */
  source?: string;
  /** Filtre par étiquette présente dans les tags du soutien. */
  tag?: string;
};

async function resolveRecipients(workspaceId: string, audience: BroadcastAudience) {
  return db.supporter.findMany({
    where: {
      workspaceId,
      ...(audience.source ? { source: audience.source } : {}),
      ...(audience.tag ? { tags: { contains: audience.tag } } : {}),
    },
    select: { id: true, email: true, name: true },
    orderBy: { lastSeenAt: "desc" },
    take: MAX_BATCH,
  });
}

/** Aperçu permettant d'afficher le nombre de destinataires avant l'envoi. */
export async function countBroadcastAudienceAction(
  audience: BroadcastAudience,
): Promise<{ count?: number; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "email:send")) return { error: "Permission refusée" };
  const recipients = await resolveRecipients(session.workspaceId, audience);
  return { count: recipients.filter((r) => r.email).length };
}

export async function sendBroadcastAction(input: {
  subject: string;
  body: string;
  audience: BroadcastAudience;
}): Promise<
  | { ok: true; sent: number; failed: number; simulated: boolean }
  | { error: string }
> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "email:send")) return { error: "Permission refusée" };

  const subject = input.subject.trim().slice(0, MAX_SUBJECT);
  const body = input.body.trim().slice(0, MAX_BODY);
  if (subject.length < 2) return { error: "Objet requis." };
  if (body.length < 10) return { error: "Message trop court." };

  const recipients = (await resolveRecipients(session.workspaceId, input.audience))
    .filter((r) => r.email);
  if (!recipients.length) return { error: "Aucun destinataire dans ce segment." };

  const workspaceName = session.workspaceName;
  const results = await Promise.allSettled(
    recipients.map((r) =>
      dispatchEmail({
        to: r.email!,
        subject,
        html:
          `<!doctype html><html><body style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#18181b;max-width:600px;margin:0 auto;padding:24px">` +
          `<p style="margin:0 0 16px">Bonjour ${escapeHtml(r.name || "")},</p>` +
          body
            .split(/\n{2,}/)
            .map(
              (p) =>
                `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`,
            )
            .join("") +
          `<p style="color:#71717a;font-size:12px;margin-top:28px">— ${escapeHtml(workspaceName)} · Vous recevez cet email en tant que soutien.</p>` +
          `</body></html>`,
      }),
    ),
  );

  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.ok) sent++;
    else failed++;
  }

  return {
    ok: true,
    sent,
    failed,
    simulated: !process.env.RESEND_API_KEY,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

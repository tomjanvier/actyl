"use server";

/**
 * Broadcast emailing to the people database (NationBuilder-style).
 * Sends a plain announcement to supporters filtered by source/tag, strictly
 * scoped to the caller's workspace, with the same dispatch pipeline as the
 * interpellation engine (Resend or simulated mode).
 */

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { dispatchEmail } from "@/lib/email";

const MAX_BATCH = 500;
const MAX_SUBJECT = 200;
const MAX_BODY = 8000;

export type BroadcastAudience = {
  /** Filter by first-touchpoint source, e.g. "newsletter", "petition". */
  source?: string;
  /** Filter by tag present in the supporter's comma-separated tags. */
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

/** Recipient preview so the UI can show "N destinataires" before sending. */
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

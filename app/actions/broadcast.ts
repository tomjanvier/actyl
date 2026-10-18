"use server";

/**
 * Envoi groupé vers la base des soutiens, filtrée par source ou étiquette et
 * strictement limitée à l'espace de l'appelant. Le pipeline est commun avec le
 * moteur d'interpellation, via Resend ou le mode simulé.
 */

import { Prisma } from "@/generated/prisma/client";
import { supporterSearchWhere } from "@/lib/supporter-search";
import { EMAIL_BATCH_LIMIT, EMAIL_BATCH_ERROR } from "@/lib/email-batch";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { dispatchEmail, wrapEmailHtml } from "@/lib/email";

const MAX_SUBJECT = 200;
const MAX_BODY = 8000;

export type BroadcastAudience = {
  /** Filtre par première source, par exemple « newsletter » ou « petition ». */
  source?: string;
  /** Filtre par étiquette présente dans les tags du soutien. */
  tag?: string;
};

function audienceWhere(workspaceId: string, audience: BroadcastAudience) {
  return Prisma.sql`${supporterSearchWhere(workspaceId, { q: "", source: audience.source?.trim() ?? "", tag: audience.tag?.trim() ?? "" })} AND btrim("email") <> ''`;
}

async function resolveRecipients(workspaceId: string, audience: BroadcastAudience) {
  const where = audienceWhere(workspaceId, audience);
  return db.$queryRaw<Array<{ id: string; email: string; name: string }>>(Prisma.sql`
    SELECT "id", "email", "name" FROM "supporters" WHERE ${where}
    ORDER BY "lastSeenAt" DESC, "id" ASC LIMIT ${EMAIL_BATCH_LIMIT + 1}
  `);
}

/** Aperçu permettant d'afficher le nombre de destinataires avant l'envoi. */
export async function countBroadcastAudienceAction(
  audience: BroadcastAudience,
): Promise<{ count?: number; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "email:send")) return { error: "Permission refusée" };
  const where = audienceWhere(session.workspaceId, audience);
  const rows = await db.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT count(*)::int AS count FROM "supporters" WHERE ${where}
  `);
  return { count: rows[0]?.count ?? 0 };
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
  if (recipients.length > EMAIL_BATCH_LIMIT) return { error: EMAIL_BATCH_ERROR };
  if (!recipients.length) return { error: "Aucun destinataire dans ce segment." };

  const workspaceName = session.workspaceName;
  const results = await Promise.allSettled(
    recipients.map((r) =>
      dispatchEmail({
        to: r.email!,
        subject,
        html: wrapEmailHtml(
          body,
          `Vous recevez ce message en tant que soutien de ${workspaceName}.`,
          null,
          {
            greeting: `Bonjour${r.name ? ` ${r.name}` : ""},`,
            workspaceName,
          },
        ),
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

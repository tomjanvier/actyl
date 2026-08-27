"use server";

/**
 * Newsletter bulk operations on directory contacts (EmailOctopus).
 * Subscribe / unsubscribe / status resync for a selection of contacts,
 * with the local newsletterStatus kept in sync after each API result.
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import {
  getNewsletterConfig,
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
  getContactNewsletterStatus,
} from "@/lib/newsletter";

const MAX_BATCH = 200;
// EmailOctopus rate limits: small concurrent chunks stay well under them.
const CONCURRENCY = 5;

async function requireContext() {
  const session = await getSession();
  if (!session)
    return { ok: false as const, error: "Non authentifié" };
  if (!can(session.role, "email:send"))
    return {
      ok: false as const,
      error: "Permission refusée — rôle Responsable campagne requis.",
    };
  const config = await getNewsletterConfig();
  if (!config.enabled)
    return { ok: false as const, error: "Module newsletter désactivé." };
  if (!config.apiKey || !config.listId)
    return {
      ok: false as const,
      error: "Configurez d'abord la connexion EmailOctopus (Réglages → Newsletter).",
    };
  return { ok: true as const, config };
}

type ContactTarget = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

async function loadTargets(contactIds: string[]): Promise<ContactTarget[]> {
  const rows = await db.contact.findMany({
    where: { id: { in: contactIds.slice(0, MAX_BATCH) } },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  return rows;
}

/** Run async work in chunks to respect provider rate limits. */
async function mapChunked<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const chunk = items.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(chunk.map(fn))));
  }
  return results;
}

async function persistStatus(
  contactId: string,
  status: string | null,
  error?: boolean,
) {
  await db.contact
    .update({
      where: { id: contactId },
      data: {
        // On failure, keep the previous value but mark the sync time so the
        // UI can show staleness without lying about the state.
        ...(error ? {} : { newsletterStatus: status }),
        newsletterSyncedAt: new Date(),
      },
    })
    .catch(() => {});
}

export async function subscribeContactsAction(input: {
  contactIds: string[];
}): Promise<{
  ok?: boolean;
  subscribed: number;
  failed: number;
  errors?: string[];
}> {
  const ctx = await requireContext();
  if (!ctx.ok) return { subscribed: 0, failed: 0, errors: [ctx.error] };

  const targets = await loadTargets(input.contactIds);
  const withEmail = targets.filter((t): t is ContactTarget & { email: string } => !!t.email);
  if (!withEmail.length)
    return { subscribed: 0, failed: 0, errors: ["Aucun contact sélectionné avec une adresse email."] };

  const results = await mapChunked(withEmail, async (t) => {
    const res = await subscribeToNewsletter(ctx.config, {
      email: t.email,
      firstName: t.firstName,
      lastName: t.lastName,
    });
    if (res.ok) {
      await persistStatus(t.id, res.status);
      return true;
    }
    await persistStatus(t.id, null, true);
    return res.error;
  });

  const errors = results.filter((r): r is string => typeof r === "string");
  revalidatePath("/contacts");
  return {
    ok: true,
    subscribed: results.length - errors.length,
    failed: errors.length,
    errors: errors.slice(0, 3),
  };
}

export async function unsubscribeContactsAction(input: {
  contactIds: string[];
}): Promise<{
  ok?: boolean;
  unsubscribed: number;
  failed: number;
  errors?: string[];
}> {
  const ctx = await requireContext();
  if (!ctx.ok)
    return { unsubscribed: 0, failed: 0, errors: [ctx.error] };

  const targets = await loadTargets(input.contactIds);
  const withEmail = targets.filter((t): t is ContactTarget & { email: string } => !!t.email);
  if (!withEmail.length)
    return { unsubscribed: 0, failed: 0, errors: ["Aucun contact sélectionné avec une adresse email."] };

  const results = await mapChunked(withEmail, async (t) => {
    const res = await unsubscribeFromNewsletter(ctx.config, t.email);
    if (res.ok) {
      await persistStatus(t.id, res.status);
      return true;
    }
    // Not on the list → treat as unsubscribed locally anyway.
    if (res.status === 404) {
      await persistStatus(t.id, "UNSUBSCRIBED");
      return true;
    }
    await persistStatus(t.id, null, true);
    return res.error;
  });

  const errors = results.filter((r): r is string => typeof r === "string");
  revalidatePath("/contacts");
  return {
    ok: true,
    unsubscribed: results.length - errors.length,
    failed: errors.length,
    errors: errors.slice(0, 3),
  };
}

/**
 * Refresh local statuses from EmailOctopus for the given contacts.
 * Read-only — safe for MEMBER roles too.
 */
export async function syncContactsNewsletterStatusAction(input: {
  contactIds: string[];
}): Promise<{ ok?: true; synced: number; missing: number; failed: number }> {
  const session = await getSession();
  if (!session)
    return { synced: 0, missing: 0, failed: 0 };
  if (!can(session.role, "contact:create"))
    return { synced: 0, missing: 0, failed: 0 };

  const config = await getNewsletterConfig();
  if (!config.enabled || !config.apiKey || !config.listId)
    return { synced: 0, missing: 0, failed: 0 };

  const targets = await loadTargets(input.contactIds);
  const withEmail = targets.filter((t): t is ContactTarget & { email: string } => !!t.email);

  let synced = 0;
  let missing = 0;
  let failed = 0;
  await mapChunked(withEmail, async (t) => {
    const res = await getContactNewsletterStatus(config, t.email);
    if (res.ok) {
      await persistStatus(t.id, res.status ?? "UNKNOWN");
      if (res.status === null) missing++;
      else synced++;
    } else {
      await persistStatus(t.id, null, true);
      failed++;
    }
  });
  revalidatePath("/contacts");
  return { ok: true, synced, missing, failed };
}

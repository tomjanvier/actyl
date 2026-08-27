import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Newsletter module — optional integration with EmailOctopus (API v2).
 * Config lives in AppSetting so it can be managed from the Settings UI:
 *   newsletter_enabled  "on" | "off"
 *   newsletter_api_key  plaintext key (masked in the UI)
 *   newsletter_list_id  selected audience list
 *
 * v2 API: https://api.emailoctopus.com, Bearer auth.
 * Contact status values: subscribed | pending | unsubscribed.
 */

const BASE_URL = "https://api.emailoctopus.com";
const TIMEOUT_MS = 10_000;

export type NewsletterConfig = {
  enabled: boolean;
  apiKey: string;
  listId: string;
};

export type NewsletterStatus = "SUBSCRIBED" | "PENDING" | "UNSUBSCRIBED";

export async function getNewsletterConfig(): Promise<NewsletterConfig> {
  const rows = await db.appSetting.findMany({
    where: { key: { in: ["newsletter_enabled", "newsletter_api_key", "newsletter_list_id"] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    enabled: map.newsletter_enabled === "on",
    apiKey: map.newsletter_api_key ?? "",
    listId: map.newsletter_list_id ?? "",
  };
}

/** Masked hint for the settings UI — never send the full key to the client. */
export function maskApiKey(key: string): string | null {
  if (!key) return null;
  const tail = key.slice(-4);
  return `••••••••••••${tail}`;
}

// ── HTTP core ────────────────────────────────────────────────────────────────

type EoResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

async function eoFetch<T>(
  apiKey: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<EoResult<T>> {
  if (!apiKey) return { ok: false, status: 401, error: "Clé API manquante." };
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, error: "EmailOctopus injoignable." };
  }

  if (res.status === 204) return { ok: true, status: 204, data: undefined as T };

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON error body — fall through to generic message.
  }
  if (!res.ok) {
    const d = data as { detail?: string; title?: string; errors?: Array<{ detail?: string }> } | null;
    const msg =
      d?.errors?.[0]?.detail ||
      d?.detail ||
      d?.title ||
      `Erreur EmailOctopus (${res.status}).`;
    return { ok: false, status: res.status, error: msg };
  }
  return { ok: true, status: res.status, data: data as T };
}

/** Contact id can be an MD5 hash of the lowercase email address. */
function contactIdFor(email: string): string {
  return createHash("md5").update(email.trim().toLowerCase()).digest("hex");
}

// ── Public operations ────────────────────────────────────────────────────────

export type EoList = { id: string; name: string; count: number };

/** Fetch account lists (up to 300) for the settings dropdown. */
export async function fetchNewsletterLists(apiKey: string): Promise<
  { ok: true; lists: EoList[] } | { ok: false; error: string }
> {
  const lists: EoList[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < 3; page++) {
    const qs = new URLSearchParams({ limit: "100" });
    if (startingAfter) qs.set("starting_after", startingAfter);
    const res = await eoFetch<{
      data: Array<{ id: string; name: string; contact_count?: number; counts?: { subscribed?: number } }>;
      paging?: { next?: { starting_after?: string } };
    }>(apiKey, `/lists?${qs.toString()}`);
    if (!res.ok) return { ok: false, error: res.error };
    for (const l of res.data.data ?? []) {
      lists.push({
        id: l.id,
        name: l.name,
        count: l.counts?.subscribed ?? l.contact_count ?? 0,
      });
    }
    startingAfter = res.data.paging?.next?.starting_after;
    if (!startingAfter) break;
  }
  return { ok: true, lists };
}

/** Validate credentials + optionally that the configured list exists. */
export async function testNewsletterConnection(input: {
  apiKey: string;
  listId?: string;
}): Promise<{ ok: true; listName?: string } | { ok: false; error: string }> {
  const lists = await fetchNewsletterLists(input.apiKey);
  if (!lists.ok) return lists;
  if (input.listId) {
    const found = lists.lists.find((l) => l.id === input.listId);
    if (!found)
      return { ok: false, error: "Liste introuvable sur ce compte EmailOctopus." };
    return { ok: true, listName: found.name };
  }
  return { ok: true };
}

/**
 * Subscribe (or update) a contact via the upsert endpoint.
 * Status is forced to "subscribed" for direct opt-ins from the CRM.
 */
export async function subscribeToNewsletter(
  config: Pick<NewsletterConfig, "apiKey" | "listId">,
  input: { email: string; firstName?: string | null; lastName?: string | null },
): Promise<
  | { ok: true; status: NewsletterStatus }
  | { ok: false; status: number; error: string }
> {
  const fields: Record<string, string> = {};
  if (input.firstName) fields.FirstName = input.firstName;
  if (input.lastName) fields.LastName = input.lastName;
  const res = await eoFetch<{ status?: string }>(
    config.apiKey,
    `/lists/${config.listId}/contacts`,
    {
      method: "POST",
      body: {
        email_address: input.email.trim().toLowerCase(),
        ...(Object.keys(fields).length ? { fields } : {}),
        status: "subscribed",
      },
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: res.error };
  return { ok: true, status: normalizeStatus(res.data.status) };
}

export async function unsubscribeFromNewsletter(
  config: Pick<NewsletterConfig, "apiKey" | "listId">,
  email: string,
): Promise<
  | { ok: true; status: NewsletterStatus }
  | { ok: false; status: number; error: string }
> {
  const res = await eoFetch<unknown>(
    config.apiKey,
    `/lists/${config.listId}/contacts/${contactIdFor(email)}`,
    { method: "PUT", body: { status: "unsubscribed" } },
  );
  if (!res.ok) return { ok: false, status: res.status, error: res.error };
  return { ok: true, status: "UNSUBSCRIBED" };
}

/**
 * Live status lookup by MD5-of-email. Returns null when the contact is not
 * on the list (404) so the caller can store UNKNOWN.
 */
export async function getContactNewsletterStatus(
  config: Pick<NewsletterConfig, "apiKey" | "listId">,
  email: string,
): Promise<{ ok: true; status: NewsletterStatus | null } | { ok: false; error: string }> {
  const res = await eoFetch<{ status?: string }>(
    config.apiKey,
    `/lists/${config.listId}/contacts/${contactIdFor(email)}`,
  );
  if (res.ok) return { ok: true, status: normalizeStatus(res.data.status) };
  if (res.status === 404) return { ok: true, status: null };
  return { ok: false, error: res.error };
}

function normalizeStatus(raw?: string): NewsletterStatus {
  switch ((raw ?? "").toLowerCase()) {
    case "subscribed":
      return "SUBSCRIBED";
    case "pending":
      return "PENDING";
    case "unsubscribed":
      return "UNSUBSCRIBED";
    default:
      return "SUBSCRIBED";
  }
}

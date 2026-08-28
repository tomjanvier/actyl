import "server-only";
import { headers } from "next/headers";

/**
 * Limiteur en mémoire à fenêtre glissante pour les actions serveur publiques.
 *
 * Suffisant contre les abus simples sur un processus Node unique.
 * À grande échelle, remplacer le stockage par Redis avec la même interface.
 */
type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

// Nettoyage périodique pour empêcher une croissance illimitée de la table.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < WINDOW_MS);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

const WINDOW_MS = 60_000; // 1 minute

export type RateLimitResult = { allowed: boolean; retryAfterSec: number };

/**
 * Vérifie et enregistre un accès pour `key`, généralement `${action}:${ip}`.
 * @param limit nombre maximal d'accès autorisés par fenêtre
 */
export function rateLimit(
  key: string,
  limit: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  // Keep memory bounded even under IP-spoofing floods.
  if (buckets.size >= MAX_BUCKETS) {
    const firstKey = buckets.keys().next().value;
    if (firstKey) buckets.delete(firstKey);
  }

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < WINDOW_MS);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    const oldest = bucket.hits[0] ?? now;
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSec: 0 };
}

/** Déduit au mieux l'adresse IP depuis les en-têtes des mandataires Vercel ou Nginx. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

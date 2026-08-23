import "server-only";
import { headers } from "next/headers";

/**
 * Minimal in-memory sliding-window rate limiter for public server actions.
 *
 * Good enough to block casual abuse on a single Node process. For horizontal
 * scaling, swap the store for Redis (same interface).
 */
type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

// Periodic sweep so the map never grows unbounded.
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
 * Check and record one hit for `key` (usually `${action}:${ip}`).
 * @param limit max hits allowed per window
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

/** Best-effort client IP from proxy headers (works behind Vercel/Nginx). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

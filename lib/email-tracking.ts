import "server-only";
import { SignJWT, jwtVerify } from "jose";

function trackingSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET missing/too short");
  return new TextEncoder().encode(secret);
}

export async function createEmailOpenToken(sentEmailId: string): Promise<string> {
  return new SignJWT({ purpose: "email-open" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sentEmailId)
    .setIssuedAt()
    .sign(trackingSecret());
}

export async function verifyEmailOpenToken(token: string, sentEmailId: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, trackingSecret(), { algorithms: ["HS256"] });
    return payload.sub === sentEmailId && payload.purpose === "email-open";
  } catch {
    return false;
  }
}

/** Returns null unless the canonical public origin is configured. */
export async function emailOpenTrackingUrl(sentEmailId: string): Promise<string | null> {
  if (!process.env.RESEND_API_KEY?.trim()) return null;
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configuredOrigin) return null;

  let origin: string;
  try {
    const url = new URL(configuredOrigin);
    if (!new Set(["http:", "https:"]).has(url.protocol) || url.username || url.password) return null;
    origin = url.origin;
  } catch {
    return null;
  }

  const token = await createEmailOpenToken(sentEmailId);
  return `${origin}/api/email/open/${encodeURIComponent(sentEmailId)}?token=${encodeURIComponent(token)}`;
}

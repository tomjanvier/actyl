import "server-only";
import { headers } from "next/headers";
import {
  expectedTurnstileHostname,
  isValidTurnstileResult,
  type TurnstileAction,
} from "@/lib/turnstile-validation";

type VerificationResult = { ok: true } | { ok: false; error: string };

const INVALID_TOKEN = "Veuillez valider la protection antispam.";
const UNAVAILABLE = "La protection antispam est momentanément indisponible.";

/** Vérifie un jeton Turnstile côté serveur avant toute écriture publique. */
export async function verifyTurnstileToken(
  token: string | undefined,
  options: {
    expectedAction: TurnstileAction;
    allowPreviewSignupBypass?: boolean;
  },
): Promise<VerificationResult> {
  // The Preview-only flag is declared in wrangler.jsonc's `previews.vars`.
  // Keep the bypass opt-in at the signup call site; public forms still verify Turnstile.
  if (
    options.allowPreviewSignupBypass &&
    process.env.ACTYL_PREVIEW_DISABLE_SIGNUP_TURNSTILE === "true"
  ) {
    return { ok: true };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return process.env.NODE_ENV === "production"
      ? { ok: false, error: UNAVAILABLE }
      : { ok: true };
  }
  if (!token || token.length > 2048) return { ok: false, error: INVALID_TOKEN };
  try {
    const requestHeaders = await headers();
    const hostname = expectedTurnstileHostname({
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      host: requestHeaders.get("host"),
      forwardedHost: requestHeaders.get("x-forwarded-host"),
    });
    if (!hostname) return { ok: false, error: UNAVAILABLE };

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { ok: false, error: UNAVAILABLE };
    const result = (await response.json()) as {
      success?: boolean;
      action?: string;
      hostname?: string;
    };
    return isValidTurnstileResult(result, options.expectedAction, hostname)
      ? { ok: true }
      : { ok: false, error: INVALID_TOKEN };
  } catch {
    return { ok: false, error: UNAVAILABLE };
  }
}

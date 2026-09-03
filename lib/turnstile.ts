import "server-only";

type VerificationResult = { ok: true } | { ok: false; error: string };

/** Vérifie un jeton Turnstile côté serveur avant toute écriture publique. */
export async function verifyTurnstileToken(token?: string): Promise<VerificationResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return process.env.NODE_ENV === "production"
      ? { ok: false, error: "La protection antispam est momentanément indisponible." }
      : { ok: true };
  }
  if (!token || token.length > 2048) return { ok: false, error: "Veuillez valider la protection antispam." };
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      cache: "no-store",
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success ? { ok: true } : { ok: false, error: "Veuillez valider la protection antispam." };
  } catch {
    return { ok: false, error: "La protection antispam est momentanément indisponible." };
  }
}

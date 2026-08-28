import "server-only";
import { EMAIL_VARIABLES } from "@/lib/constants";

export type TemplateContext = Record<string, string | null | undefined>;

const KNOWN_VARS = new Set(
  EMAIL_VARIABLES.map((v) => v.key.slice(2, v.key.length - 2)),
);

/**
 * Remplace les espaces réservés {{variable}}. Les variables inconnues restent
 * visibles afin de signaler une erreur de modèle.
 */
export function renderTemplate(text: string, ctx: TemplateContext): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    if (!KNOWN_VARS.has(key)) return match;
    const value = ctx[key];
    return value === null || value === undefined ? "" : value;
  });
}

export function extractVariables(text: string): string[] {
  const known = new Set(
    EMAIL_VARIABLES.map((v) => v.key.slice(2, v.key.length - 2)),
  );
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
    if (known.has(m[1]!)) found.add(m[1]!);
  }
  return [...found];
}

export type DispatchResult =
  | { ok: true; providerId: string; simulated: boolean }
  | { ok: false; error: string };

/**
 * Envoie un email via Resend lorsqu'il est configuré ; sinon enregistre un envoi
 * simulé afin que le pipeline reste vérifiable sans clé en développement.
 */
export async function dispatchEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<DispatchResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || "Actyl <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(`[email:simulated] to=${params.to} subject="${params.subject}"`);
    return { ok: true, providerId: `sim_${crypto.randomUUID()}`, simulated: true };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, providerId: result.data?.id ?? "", simulated: false };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur inconnue",
    };
  }
}

/** Mise en page HTML sobre pour les emails d'interpellation. */
export function wrapEmailHtml(body: string, signature?: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.6;color:#18181b;max-width:640px;margin:0 auto;padding:24px">
${paragraphs}${signature ? `<p style="color:#52525b;font-size:13px;margin-top:32px">${escapeHtml(signature)}</p>` : ""}
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

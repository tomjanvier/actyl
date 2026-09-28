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

function publicBaseUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
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
export function wrapEmailHtml(
  body: string,
  signature?: string,
  trackingUrl?: string | null,
  options: { greeting?: string; workspaceName?: string } = {},
): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const baseUrl = publicBaseUrl();
  const logoUrl = baseUrl ? `${baseUrl}/brand/actyl-clair-logo.svg` : null;
  const greeting = options.greeting
    ? `<p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#25232a">${escapeHtml(options.greeting)}</p>`
    : "";
  const brandName = options.workspaceName?.trim() || "PLAID·ACT";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Message de ${escapeHtml(brandName)}</title></head><body style="margin:0;padding:0;background-color:#f5f3f1;font-family:Arial,Helvetica,sans-serif;color:#25232a;-webkit-text-size-adjust:100%">
<div style="display:none;font-size:1px;color:#f5f3f1;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">Un message de ${escapeHtml(brandName)} via Actyl.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f3f1"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #ebe7e3;border-radius:18px;overflow:hidden">
<tr><td style="height:6px;background-color:#d95a4d;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:26px 32px 22px;border-bottom:1px solid #f0ece8"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="left" valign="middle">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" width="130" alt="Actyl" style="display:block;width:130px;height:auto;border:0">` : `<span style="font-size:23px;font-weight:700;letter-spacing:-1px;color:#51414f">actyl</span>`}</td><td align="right" valign="middle" style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#817780">${escapeHtml(brandName)}</td></tr></table></td></tr>
<tr><td style="padding:34px 36px 20px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.75;color:#302b30">${greeting}${paragraphs}${signature ? `<p style="color:#635a61;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;margin:28px 0 0">${escapeHtml(signature)}</p>` : ""}</td></tr>
<tr><td style="padding:20px 36px 25px;background-color:#faf8f6;border-top:1px solid #f0ece8"><p style="margin:0;color:#6e656c;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6">Envoyé avec <strong style="color:#51414f">Actyl</strong> · un outil de mobilisation citoyenne par PLAID·ACT.</p></td></tr>
</table>${trackingUrl ? `<p style="max-width:600px;margin:14px auto 0;padding:0 12px;color:#8b8389;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.5">Ce message contient un dispositif de mesure de l’ouverture utilisé pour suivre l’efficacité de la campagne.</p><img src="${escapeHtml(trackingUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />` : ""}
</td></tr></table></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

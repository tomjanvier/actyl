/**
 * Client SSO vers Act (fournisseur d'identité OIDC).
 *
 * Act authentifie via Google (comptes invités) puis délivre des identités
 * à Actyl en flux Authorization Code + PKCE S256. La source faisant foi
 * est `userinfo` côté serveur (jamais le token décodé côté client).
 *
 * Configuration (variables d'environnement) :
 * - ACT_SSO_ISSUER    ex. https://act.plaidact.org
 * - ACT_SSO_CLIENT_ID ex. actyl-prod (enregistré côté Act)
 * - ACT_SSO_CLIENT_SECRET (vide pour client public, PKCE seul)
 * - NEXT_PUBLIC_APP_URL ex. https://actyl.org (callback)
 *
 * Sans ces variables, le bouton « Se connecter avec Act » est masqué
 * et les routes répondent 503 (le login mot de passe reste disponible).
 */
import "server-only";
import { createHash, randomBytes } from "node:crypto";

export const ACT_SSO_STATE_COOKIE = "actyl_act_sso_state";
export const ACT_SSO_VERIFIER_COOKIE = "actyl_act_sso_verifier";
export const ACT_SSO_NEXT_COOKIE = "actyl_act_sso_next";
const STATE_TTL_SECONDS = 600;

export type ActSsoConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string | null;
  redirectUri: string;
};

export function getActSsoConfig(): ActSsoConfig | null {
  const issuer = (process.env.ACT_SSO_ISSUER ?? "").trim().replace(/\/+$/, "");
  const clientId = (process.env.ACT_SSO_CLIENT_ID ?? "").trim();
  if (!issuer || !clientId) return null;
  // Défaut :3001 car Act (fournisseur OIDC) occupe :3000 en dev local
  // (les deux apps tournent côte à côte pour tester le SSO).
  const base =
    (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "") ||
    "http://localhost:3001";
  try {
    for (const value of [issuer, base]) {
      const url = new URL(value);
      if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
      if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    }
  } catch { return null; }
  if (process.env.NODE_ENV === "production" && !process.env.ACT_SSO_CLIENT_SECRET) return null;
  return {
    issuer,
    clientId,
    clientSecret: (process.env.ACT_SSO_CLIENT_SECRET ?? "").trim() || null,
    redirectUri: `${base}/api/auth/act/callback`,
  };
}

export function isActSsoEnabled(): boolean {
  return getActSsoConfig() !== null;
}

export function newState(): string {
  return randomBytes(24).toString("base64url");
}

export function newVerifier(): string {
  // 64 caractères non réservés (RFC 7636, 43-128 requis).
  return randomBytes(48).toString("base64url");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function getActDiscovery(issuer: string): Promise<{
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
} | null> {
  try {
    const res = await fetch(`${issuer}/.well-known/openid-configuration`, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    if (
      typeof data.authorization_endpoint !== "string" ||
      typeof data.token_endpoint !== "string" ||
      typeof data.userinfo_endpoint !== "string"
    ) {
      return null;
    }
    if (data.issuer !== issuer) return null;
    for (const endpoint of [data.authorization_endpoint, data.token_endpoint, data.userinfo_endpoint]) {
      if (new URL(endpoint).origin !== new URL(issuer).origin) return null;
    }
    return {
      authorization_endpoint: data.authorization_endpoint,
      token_endpoint: data.token_endpoint,
      userinfo_endpoint: data.userinfo_endpoint,
    };
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl(
  authorizationEndpoint: string,
  config: ActSsoConfig,
  state: string,
  challenge: string,
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${authorizationEndpoint}?${params.toString()}`;
}

/** Redirection post-connexion sûre : chemin relatif local uniquement. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  try {
    const parsed = new URL(next, "http://localhost");
    const safe = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return safe.startsWith("/") ? safe : "/";
  } catch {
    return "/";
  }
}

export type ActUserinfo = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  roles?: string[];
};

export async function exchangeCode(
  tokenEndpoint: string,
  config: ActSsoConfig,
  code: string,
  verifier: string,
): Promise<{ accessToken: string } | null> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: verifier,
  });
  if (config.clientSecret) body.set("client_secret", config.clientSecret);
  try {
    const res = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) return null;
    return { accessToken: data.access_token };
  } catch {
    return null;
  }
}

export async function fetchActUserinfo(
  userinfoEndpoint: string,
  accessToken: string,
): Promise<ActUserinfo | null> {
  try {
    const res = await fetch(userinfoEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ActUserinfo;
    if (typeof data.sub !== "string" || !data.sub || typeof data.email !== "string" || !data.email || data.email_verified !== true) return null;
    if (data.roles && (!Array.isArray(data.roles) || data.roles.some((role) => typeof role !== "string"))) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Mappage des rôles Act vers Actyl (additif : on accorde, on ne rétrograde
 * jamais un super-admin existant via le SSO).
 * - admin → super-admin + ADMIN
 * - bureau → ADMIN
 * - editeur → CAMPAIGNER
 * - membre → MEMBER
 * - observateur → OBSERVER
 */
export function mapActRoles(roles: string[]): {
  isSuperAdmin: boolean;
  membershipRole: "ADMIN" | "CAMPAIGNER" | "MEMBER" | "OBSERVER";
} {
  const set = new Set(roles.map((r) => r.toLowerCase()));
  if (set.has("admin")) return { isSuperAdmin: true, membershipRole: "ADMIN" };
  if (set.has("bureau")) return { isSuperAdmin: false, membershipRole: "ADMIN" };
  if (set.has("editeur") || set.has("editor")) return { isSuperAdmin: false, membershipRole: "CAMPAIGNER" };
  if (set.has("observateur") || set.has("observer")) return { isSuperAdmin: false, membershipRole: "OBSERVER" };
  return { isSuperAdmin: false, membershipRole: "MEMBER" };
}

export function stateCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  };
}

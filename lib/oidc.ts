import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

const CODE_TTL = 60;
const TOKEN_TTL = 3600;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const opaque = () => randomBytes(32).toString("base64url");
const error = (message: string, status = 400) => Response.json({ error: message }, { status });

export function issuer() {
  return (process.env.ACT_OIDC_ISSUER ?? "https://act.plaidact.org").replace(/\/$/, "");
}

export function discovery() {
  const base = issuer();
  return Response.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    userinfo_endpoint: `${base}/oauth/userinfo`,
    end_session_endpoint: `${base}/oauth/end-session`,
    response_types_supported: ["code"], grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"], scopes_supported: ["openid", "email", "profile"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
  });
}

async function findClient(clientId: string) {
  return db.oidcClient.findUnique({ where: { clientId } });
}

export async function authorize(request: Request) {
  const url = new URL(request.url); const p = url.searchParams;
  const clientId = p.get("client_id") ?? ""; const redirectUri = p.get("redirect_uri") ?? "";
  const client = await findClient(clientId);
  if (!client || client.revokedAt || !client.redirectUris.split("\n").includes(redirectUri)) return error("invalid_client");
  if (p.get("response_type") !== "code" || p.get("code_challenge_method") !== "S256" || !p.get("code_challenge")) return error("invalid_request");
  if (!(p.get("scope") ?? "").split(" ").includes("openid")) return error("invalid_scope");
  const session = await getSession();
  if (!session) return Response.redirect(new URL(`/sign-in?next=${encodeURIComponent(`/oauth/authorize?${p.toString()}`)}`, url));
  const code = opaque();
  await db.oidcAuthorizationCode.create({ data: { codeHash: hash(code), clientId: client.id, userId: session.user.id, redirectUri, codeChallenge: p.get("code_challenge")!, scope: p.get("scope")!, expiresAt: new Date(Date.now() + CODE_TTL * 1000) } });
  const callback = new URL(redirectUri); callback.searchParams.set("code", code); if (p.get("state")) callback.searchParams.set("state", p.get("state")!);
  return Response.redirect(callback);
}

export async function token(request: Request) {
  const form = await request.formData();
  if (form.get("grant_type") !== "authorization_code") return error("unsupported_grant_type");
  const client = await findClient(String(form.get("client_id") ?? "")); const rawCode = String(form.get("code") ?? "");
  if (!client || client.revokedAt || !rawCode) return error("invalid_grant");
  if (client.clientSecretHash && hash(String(form.get("client_secret") ?? "")) !== client.clientSecretHash) return error("invalid_client", 401);
  const stored = await db.oidcAuthorizationCode.findUnique({ where: { codeHash: hash(rawCode) } });
  if (!stored || stored.usedAt || stored.expiresAt < new Date() || stored.clientId !== client.id || stored.redirectUri !== String(form.get("redirect_uri") ?? "")) return error("invalid_grant");
  const verifier = String(form.get("code_verifier") ?? "");
  if (createHash("sha256").update(verifier).digest("base64url") !== stored.codeChallenge) return error("invalid_grant");
  const claimed = await db.oidcAuthorizationCode.updateMany({ where: { id: stored.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return error("invalid_grant");
  const accessToken = opaque();
  await db.oidcAccessToken.create({ data: { tokenHash: hash(accessToken), clientId: client.id, userId: stored.userId, scope: stored.scope, expiresAt: new Date(Date.now() + TOKEN_TTL * 1000) } });
  return Response.json({ access_token: accessToken, token_type: "Bearer", expires_in: TOKEN_TTL, scope: stored.scope });
}

export async function userinfo(request: Request) {
  const raw = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!raw) return error("invalid_token", 401);
  const token = await db.oidcAccessToken.findUnique({ where: { tokenHash: hash(raw) }, include: { user: { include: { memberships: true } } } });
  if (!token || token.revokedAt || token.expiresAt < new Date()) return error("invalid_token", 401);
  return Response.json({ sub: token.user.id, email: token.user.email, email_verified: true, name: token.user.name, roles: [...new Set(token.user.memberships.map((m) => m.role.toLowerCase()))] });
}

export async function registerClient(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return error("forbidden", 403);
  const body = await request.json() as { client_id?: string; name?: string; redirect_uris?: string[]; client_secret?: string };
  if (!body.client_id || !body.name || !body.redirect_uris?.length || body.redirect_uris.some((uri) => !uri.startsWith("https://"))) return error("invalid_request");
  const created = await db.oidcClient.create({ data: { clientId: body.client_id, name: body.name, redirectUris: body.redirect_uris.join("\n"), clientSecretHash: body.client_secret ? hash(body.client_secret) : null } });
  return Response.json({ client_id: created.clientId, name: created.name, redirect_uris: body.redirect_uris }, { status: 201 });
}

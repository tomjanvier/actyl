import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createSession, hashPassword, setWorkspaceCookie } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ACT_SSO_NEXT_COOKIE,
  ACT_SSO_STATE_COOKIE,
  ACT_SSO_VERIFIER_COOKIE,
  exchangeCode,
  fetchActUserinfo,
  getActDiscovery,
  getActSsoConfig,
  mapActRoles,
  safeNextPath,
} from "@/lib/act-sso";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/auth/act/callback — retour OIDC d'Act.
 *
 * 1. Vérifie `state` (cookie à usage unique) et le `code`.
 * 2. Échange code → access_token (PKCE), puis `userinfo` en Bearer.
 * 3. Lie le compte sur `actSub` puis `email` (additif : jamais d'écrasement
 *    du mot de passe ni rétrogradation d'un super-admin existant).
 * 4. Crée la session Actyl (+ rattachement à l'espace par défaut si besoin).
 */
export async function GET(request: Request) {
  const rl = rateLimit(`act-sso-callback:${await clientIp()}`, 10);
  const appUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "") ||
    new URL(request.url).origin;
  if (!rl.allowed) return NextResponse.redirect(`${appUrl}/sign-in?error=act_failed`);
  const config = getActSsoConfig();
  if (!config) return NextResponse.redirect(`${appUrl}/sign-in?error=act_unconfigured`);

  const url = new URL(request.url);
  if (url.searchParams.get("error")) {
    return NextResponse.redirect(`${appUrl}/sign-in?error=act_denied`);
  }
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (!code || !state) return NextResponse.redirect(`${appUrl}/sign-in?error=act_state`);

  const jar = await cookies();
  const expectedState = jar.get(ACT_SSO_STATE_COOKIE)?.value;
  const verifier = jar.get(ACT_SSO_VERIFIER_COOKIE)?.value;
  const next = safeNextPath(jar.get(ACT_SSO_NEXT_COOKIE)?.value);
  // État à usage unique dans tous les cas.
  jar.delete(ACT_SSO_STATE_COOKIE);
  jar.delete(ACT_SSO_VERIFIER_COOKIE);
  jar.delete(ACT_SSO_NEXT_COOKIE);
  if (!verifier || !expectedState || expectedState !== state) {
    return NextResponse.redirect(`${appUrl}/sign-in?error=act_state`);
  }

  const discovery = await getActDiscovery(config.issuer);
  if (!discovery) return NextResponse.redirect(`${appUrl}/sign-in?error=act_unreachable`);

  const tokens = await exchangeCode(discovery.token_endpoint, config, code, verifier);
  if (!tokens) return NextResponse.redirect(`${appUrl}/sign-in?error=act_token`);

  const identity = await fetchActUserinfo(discovery.userinfo_endpoint, tokens.accessToken);
  if (!identity || identity.email_verified !== true) {
    return NextResponse.redirect(`${appUrl}/sign-in?error=act_identity`);
  }
  const email = identity.email.trim().toLowerCase();
  const name = identity.name?.trim() || email;
  const { membershipRole } = mapActRoles(identity.roles ?? []);

  try {
    // Liaison par sub Act, puis par email (comptes préexistants conservés).
    let user = await db.user.findUnique({ where: { actSub: identity.sub } });
    if (!user) {
      const byEmail = await db.user.findUnique({ where: { email } });
      if (byEmail) {
        if (byEmail.actSub && byEmail.actSub !== identity.sub) throw new Error("ACT_IDENTITY_CONFLICT");
        user = await db.user.update({
          where: { id: byEmail.id },
          data: {
            actSub: byEmail.actSub ?? identity.sub,
          },
        });
      } else {
        user = await db.user.create({
          data: {
            email,
            name: name.slice(0, 120),
            // Mot de passe aléatoire inutilisable : la connexion passe par Act.
            passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
            actSub: identity.sub,
            isSuperAdmin: false,
          },
        });
      }
    }

    // Rattachement : conserve les memberships existants ; sinon rattache à
    // l'espace le plus ancien (ou en crée un si aucun n'existe).
    const memberships = await db.membership.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { workspaceId: true },
    });
    let workspaceId = memberships[0]?.workspaceId;
    if (!workspaceId) {
      // L'espace cible est explicite : aucune adhésion automatique à un autre locataire.
      const configuredWorkspace = process.env.ACT_SSO_WORKSPACE_ID;
      const configuredSlug = process.env.ACT_SSO_WORKSPACE_SLUG;
      if (!configuredWorkspace && !configuredSlug) throw new Error("ACT_WORKSPACE_REQUIRED");
      const workspace = configuredWorkspace
        ? await db.workspace.findUnique({ where: { id: configuredWorkspace }, select: { id: true } })
        : await db.workspace.upsert({ where: { slug: configuredSlug! }, create: { slug: configuredSlug!, name: "PLAID·ACT" }, update: {}, select: { id: true } });
      if (!workspace) throw new Error("ACT_WORKSPACE_UNKNOWN");
      workspaceId = workspace.id;
      await db.membership.upsert({
        where: { userId_workspaceId: { userId: user.id, workspaceId } },
        create: { userId: user.id, workspaceId, role: membershipRole }, update: {},
      });
    }

    await createSession(user.id);
    await setWorkspaceCookie(workspaceId);
    return NextResponse.redirect(`${appUrl}${next}`);
  } catch (error) {
    const reason = error instanceof Error && [
      "ACT_IDENTITY_CONFLICT",
      "ACT_WORKSPACE_REQUIRED",
      "ACT_WORKSPACE_UNKNOWN",
    ].includes(error.message)
      ? error.message
      : "ACT_SESSION_OR_DATABASE_FAILURE";
    // Un code borné suffit au diagnostic ; aucune identité ni erreur SQL n'est journalisée.
    console.error("[act-sso] account provisioning failed", reason);
    return NextResponse.redirect(`${appUrl}/sign-in?error=act_failed`);
  }
}

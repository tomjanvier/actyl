import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createSession, hashPassword, setWorkspaceCookie } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";
import {
  ACT_SSO_NEXT_COOKIE,
  ACT_SSO_STATE_COOKIE,
  exchangeCode,
  fetchActUserinfo,
  getActDiscovery,
  getActSsoConfig,
  mapActRoles,
  safeNextPath,
} from "@/lib/act-sso";

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
  const config = getActSsoConfig();
  const appUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "") ||
    new URL(request.url).origin;
  if (!config) return NextResponse.redirect(`${appUrl}/sign-in?error=act_unconfigured`);

  const url = new URL(request.url);
  if (url.searchParams.get("error")) {
    return NextResponse.redirect(`${appUrl}/sign-in?error=act_denied`);
  }
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (!code || !state) return NextResponse.redirect(`${appUrl}/sign-in?error=act_state`);

  const jar = await cookies();
  const verifier = jar.get(`${ACT_SSO_STATE_COOKIE}:${state}`)?.value;
  const next = safeNextPath(jar.get(ACT_SSO_NEXT_COOKIE)?.value);
  // État à usage unique dans tous les cas.
  jar.delete(`${ACT_SSO_STATE_COOKIE}:${state}`);
  jar.delete(ACT_SSO_NEXT_COOKIE);
  if (!verifier) return NextResponse.redirect(`${appUrl}/sign-in?error=act_state`);

  const discovery = await getActDiscovery(config.issuer);
  if (!discovery) return NextResponse.redirect(`${appUrl}/sign-in?error=act_unreachable`);

  const tokens = await exchangeCode(discovery.token_endpoint, config, code, verifier);
  if (!tokens) return NextResponse.redirect(`${appUrl}/sign-in?error=act_token`);

  const identity = await fetchActUserinfo(discovery.userinfo_endpoint, tokens.accessToken);
  if (!identity || identity.email_verified === false) {
    return NextResponse.redirect(`${appUrl}/sign-in?error=act_identity`);
  }
  const email = identity.email.trim().toLowerCase();
  const name = identity.name?.trim() || email;
  const { isSuperAdmin, membershipRole } = mapActRoles(identity.roles ?? []);

  try {
    // Liaison par sub Act, puis par email (comptes préexistants conservés).
    let user = await db.user.findUnique({ where: { actSub: identity.sub } });
    if (!user) {
      const byEmail = await db.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await db.user.update({
          where: { id: byEmail.id },
          data: {
            actSub: byEmail.actSub ?? identity.sub,
            // Additif : on accorde le super-admin, on ne le retire jamais via SSO.
            ...(isSuperAdmin && !byEmail.isSuperAdmin ? { isSuperAdmin: true } : {}),
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
            isSuperAdmin,
          },
        });
      }
    } else if (isSuperAdmin && !user.isSuperAdmin) {
      user = await db.user.update({ where: { id: user.id }, data: { isSuperAdmin: true } });
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
      const oldest = await db.workspace.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
      if (oldest) {
        workspaceId = oldest.id;
        await db.membership.create({ data: { userId: user.id, workspaceId, role: membershipRole } });
      } else {
        const workspace = await db.workspace.create({
          data: { name: "Équipe", slug: `equipe-${slugify(email.split("@")[0] ?? "act")}` },
        });
        workspaceId = workspace.id;
        await db.membership.create({ data: { userId: user.id, workspaceId, role: "ADMIN" } });
      }
    }

    await createSession(user.id);
    await setWorkspaceCookie(workspaceId);
    return NextResponse.redirect(`${appUrl}${next}`);
  } catch {
    return NextResponse.redirect(`${appUrl}/sign-in?error=act_failed`);
  }
}

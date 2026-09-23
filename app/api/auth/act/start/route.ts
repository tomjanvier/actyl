import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ACT_SSO_NEXT_COOKIE,
  ACT_SSO_STATE_COOKIE,
  ACT_SSO_VERIFIER_COOKIE,
  buildAuthorizeUrl,
  getActDiscovery,
  getActSsoConfig,
  newState,
  newVerifier,
  pkceChallenge,
  safeNextPath,
  stateCookieOptions,
} from "@/lib/act-sso";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/auth/act/start — initie la connexion via Act.
 * Crée l'état anti-CSRF + vérifieur PKCE (cookies httpOnly, 10 min),
 * puis redirige vers l'autorisation Act. `?next=` préserve la destination.
 */
export async function GET(request: Request) {
  const rl = rateLimit(`act-sso-start:${await clientIp()}`, 10);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Trop de tentatives, réessayez." }, { status: 429 });
  }
  const config = getActSsoConfig();
  if (!config) {
    return NextResponse.json({ error: "Connexion Act non configurée." }, { status: 503 });
  }
  const discovery = await getActDiscovery(config.issuer);
  if (!discovery) {
    return NextResponse.json({ error: "Act injoignable (découverte OIDC)." }, { status: 502 });
  }
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const state = newState();
  const verifier = newVerifier();

  const jar = await cookies();
  // État + vérifieur PKCE en cookies à noms fixes (httpOnly, 10 min).
  // Le `state` renvoyé par Act est comparé au cookie ; le vérifieur
  // ne transite jamais par l'URL. Noms fixes : pas de `:` interdit
  // dans les noms de cookies (RFC 6265) et pas d'accumulation.
  jar.set(ACT_SSO_STATE_COOKIE, state, stateCookieOptions());
  jar.set(ACT_SSO_VERIFIER_COOKIE, verifier, stateCookieOptions());
  jar.set(ACT_SSO_NEXT_COOKIE, next, stateCookieOptions());

  return NextResponse.redirect(
    buildAuthorizeUrl(discovery.authorization_endpoint, config, state, pkceChallenge(verifier)),
  );
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ACT_SSO_NEXT_COOKIE,
  ACT_SSO_STATE_COOKIE,
  buildAuthorizeUrl,
  getActDiscovery,
  getActSsoConfig,
  newState,
  newVerifier,
  pkceChallenge,
  safeNextPath,
  stateCookieOptions,
} from "@/lib/act-sso";

/**
 * GET /api/auth/act/start — initie la connexion via Act.
 * Crée l'état anti-CSRF + vérifieur PKCE (cookies httpOnly, 10 min),
 * puis redirige vers l'autorisation Act. `?next=` préserve la destination.
 */
export async function GET(request: Request) {
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
  // Le vérifieur est stocké sous une clé dérivée de l'état (usage unique).
  jar.set(`${ACT_SSO_STATE_COOKIE}:${state}`, verifier, stateCookieOptions());
  jar.set(ACT_SSO_NEXT_COOKIE, next, stateCookieOptions());

  return NextResponse.redirect(
    buildAuthorizeUrl(discovery.authorization_endpoint, config, state, pkceChallenge(verifier)),
  );
}

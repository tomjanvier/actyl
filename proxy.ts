import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Proxy (ex-middleware, Next 16): two jobs.
 *
 * 1. Protège chaque route du tableau de bord par un cookie de session valide.
 *    - La signature JWT est vérifiée, pas seulement la présence du cookie.
 *    - A missing or short AUTH_SECRET fails closed: all protected routes
 *      redirigées vers /sign-in afin de ne jamais être exposées par erreur.
 *
 * 2. Framing policy.
 *    - Toutes les pages refusent l'intégration, sauf `/embed/*`, conçu pour les
 *      sites tiers comme WordPress, avec une politique CSP dédiée et `noindex`.
 */
const SESSION_COOKIE = "actyl_session";

const PROTECTED_PREFIXES = [
  "/admin",
  "/contacts",
  "/campaigns",
  "/lists",
  "/settings",
  "/inbox",
  "/tasks",
  "/events",
  "/supporters",
  "/presidentielle",
  "/campaign-teams",
];

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Autorise l'intégration des contenus publics et les exclut des moteurs de recherche.
  if (pathname.startsWith("/embed/")) {
    const res = NextResponse.next();
    res.headers.set("Content-Security-Policy", "frame-ancestors *");
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }

  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const response = NextResponse.next();

  if (needsAuth) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const secret = process.env.AUTH_SECRET;

    // Refuse l'accès si la configuration de l'application est incomplète.
    const isValid =
      !!token &&
      !!secret &&
      secret.length >= 16 &&
      (await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ["HS256"],
      })
        .then(() => true)
        .catch(() => false));

    if (!isValid) {
      const url = new URL("/sign-in", request.url);
      url.searchParams.set("next", pathname);
      return noStore(NextResponse.redirect(url));
    }

    response.headers.set("X-Frame-Options", "DENY");
    return noStore(response);
  }

  // API and OAuth responses can carry account data, tokens, or cron status.
  // Keep them out of edge/browser caches even when a route returns an error.
  if (pathname === "/api" || pathname.startsWith("/api/") || pathname.startsWith("/oauth/")) {
    noStore(response);
  }

  // Interdit aussi l'intégration des autres pages publiques de l'application.
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)",
  ],
};

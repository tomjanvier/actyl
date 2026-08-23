import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Edge middleware: two jobs.
 *
 * 1. Gate every dashboard route behind a valid session cookie.
 *    - The JWT signature is verified here (not just presence of the cookie).
 *    - A missing or short AUTH_SECRET fails closed: all protected routes
 *      redirect to /sign-in rather than being accidentally exposed.
 *
 * 2. Framing policy.
 *    - Everything is frame-DENY except `/embed/*`, which is meant to be
 *      iframed on third-party sites (WordPress…) — those get an open
 *      `frame-ancestors` CSP and `noindex` instead.
 */
const SESSION_COOKIE = "ahq_session";

const PROTECTED_PREFIXES = [
  "/contacts",
  "/campaigns",
  "/lists",
  "/settings",
  "/inbox",
  "/tasks",
  "/events",
  "/supporters",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public embeds: allow framing from anywhere, keep them out of search indexes.
  if (pathname.startsWith("/embed/")) {
    const res = NextResponse.next();
    res.headers.set("Content-Security-Policy", "frame-ancestors *");
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }

  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  let response = NextResponse.next();

  if (needsAuth) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const secret = process.env.AUTH_SECRET;

    // Fail closed when the app is misconfigured.
    const isValid =
      !!token &&
      !!secret &&
      secret.length >= 16 &&
      (await jwtVerify(token, new TextEncoder().encode(secret))
        .then(() => true)
        .catch(() => false));

    if (!isValid) {
      const url = new URL("/sign-in", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  // Remaining public app pages (/, /p/*, /sign-in…): deny framing too.
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)",
  ],
};

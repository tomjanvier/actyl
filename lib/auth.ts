/**
 * Session management: signed JWT (jose) stored in an httpOnly cookie,
 * bcrypt password hashing, and multi-workspace session context.
 *
 * The middleware verifies the same JWT at the edge before any dashboard route;
 * `requireSession()` is the defense-in-depth guard inside server components.
 */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { Role } from "@/lib/constants";

const SESSION_COOKIE = "actyl_session";
const WORKSPACE_COOKIE = "actyl_ws";
const SESSION_DAYS = 30;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET missing/too short");
  return new TextEncoder().encode(s);
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 11);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(WORKSPACE_COOKIE);
}

export async function setWorkspaceCookie(workspaceId: string) {
  const jar = await cookies();
  jar.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  jobTitle: string | null;
};

export type SessionContext = {
  user: SessionUser;
  workspaceId: string;
  role: Role;
  workspaceName: string;
  workspaceSlug: string;
  logoEmoji: string;
};

/** Returns the signed-in user + active workspace context, or null. */
export async function getSession(): Promise<SessionContext | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secret());
    userId = payload.sub as string;
  } catch {
    return null;
  }

  const memberships = await db.membership.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, name: true, slug: true, logoEmoji: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (!memberships.length) return null;

  const wanted = jar.get(WORKSPACE_COOKIE)?.value;
  const membership =
    memberships.find((m) => m.workspaceId === wanted) ?? memberships[0]!;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, jobTitle: true },
  });
  if (!user) return null;

  return {
    user,
    workspaceId: membership.workspaceId,
    role: membership.role as Role,
    workspaceName: membership.workspace.name,
    workspaceSlug: membership.workspace.slug,
    logoEmoji: membership.workspace.logoEmoji,
  };
}

/** Server-component guard: redirects to /sign-in when unauthenticated. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

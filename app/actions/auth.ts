"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  setWorkspaceCookie,
  verifyPassword,
} from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { getSignupMode } from "@/lib/signup-mode";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const signUpSchema = z.object({
  name: z.string().min(2, "Nom trop court"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
  workspaceName: z.string().min(2, "Nom d'association requis"),
  website: z.string().max(200).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
});

export type ActionState =
  | { error?: string; pending?: boolean }
  | undefined;

export async function signUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Anti-abuse: 5 signups per minute per IP.
  const rl = rateLimit(`sign-up:${await clientIp()}`, 5);
  if (!rl.allowed)
    return { error: `Trop de tentatives. Réessayez dans ${rl.retryAfterSec}s.` };

  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const { name, email, password, workspaceName, website, phone } = parsed.data;
  const mode = await getSignupMode();

  const lowerEmail = email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email: lowerEmail } });
  if (existing) return { error: "Un compte existe déjà avec cet email." };

  if (mode === "APPROVAL") {
    const alreadyRequested = await db.accountRequest.findUnique({
      where: { email: lowerEmail },
    });
    if (alreadyRequested && alreadyRequested.status === "PENDING") {
      return {
        pending: true,
        error: undefined,
      } as ActionState;
    }
    await db.accountRequest.upsert({
      where: { email: lowerEmail },
      create: {
        name,
        email: lowerEmail,
        passwordHash: await hashPassword(password),
        orgName: workspaceName,
        website: website || null,
        phone: phone || null,
        status: "PENDING",
      },
      update: {
        name,
        passwordHash: await hashPassword(password),
        orgName: workspaceName,
        website: website || null,
        phone: phone || null,
        status: "PENDING",
      },
    });
    return { pending: true };
  }

  let slug = slugify(workspaceName);
  if (!slug) slug = `workspace-${Date.now()}`;
  if (await db.workspace.findUnique({ where: { slug } })) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      passwordHash: await hashPassword(password),
      memberships: {
        create: {
          role: "ADMIN",
          workspace: {
            create: {
              name: workspaceName,
              slug,
              website: website || null,
              phone: phone || null,
            },
          },
        },
      },
    },
    include: { memberships: true },
  });

  await createSession(user.id);
  await setWorkspaceCookie(user.memberships[0]!.workspaceId);
  redirect("/contacts");
}

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Brute-force throttle: 10 attempts per minute per IP.
  const rl = rateLimit(`sign-in:${await clientIp()}`, 10);
  if (!rl.allowed)
    return { error: `Trop de tentatives. Réessayez dans ${rl.retryAfterSec}s.` };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email et mot de passe requis." };

  const user = await db.user.findUnique({
    where: { email },
    include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Identifiants incorrects." };
  }
  await createSession(user.id);
  if (user.memberships[0]) await setWorkspaceCookie(user.memberships[0].workspaceId);
  redirect(safeNext(formData.get("next")));
}

/** Autorise uniquement les redirections relatives de même origine. */
function safeNext(next: FormDataEntryValue | null): string {
  const n = String(next ?? "/contacts");
  if (!n.startsWith("/") || n.startsWith("//") || n.includes("\\")) {
    return "/contacts";
  }
  return n;
}

export async function signOutAction() {
  await destroySession();
  redirect("/sign-in");
}

export async function switchWorkspaceAction(workspaceId: string) {
  await setWorkspaceCookie(workspaceId);
}

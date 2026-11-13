"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSession,
  destroySession,
  getSession,
  hashPassword,
  setWorkspaceCookie,
  verifyPassword,
} from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { getSignupMode } from "@/lib/signup-mode";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createHash } from "node:crypto";

const signUpSchema = z.object({
  name: z.string().min(2, "Nom trop court"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
  workspaceName: z.string().min(2, "Nom d'association requis"),
  website: z.string().max(200).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  monthlyContributionInterest: z.enum(["YES", "NO", "DISCUSS"]),
  monthlyContributionAmount: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : Number(value)),
    z.number().int().min(1).max(100000).optional(),
  ),
}).superRefine((data, context) => {
  if (data.monthlyContributionInterest === "YES" && !data.monthlyContributionAmount) {
    context.addIssue({
      code: "custom",
      path: ["monthlyContributionAmount"],
      message: "Indiquez le montant mensuel envisagé, ou choisissez « À discuter ».",
    });
  }
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
  const captcha = await verifyTurnstileToken(
    String(formData.get("cf-turnstile-response") ?? ""),
    { allowPreviewSignupBypass: true },
  );
  if (!captcha.ok) return { error: captcha.error };
  const {
    name,
    email,
    password,
    workspaceName,
    website,
    phone,
    monthlyContributionInterest,
    monthlyContributionAmount,
  } = parsed.data;
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
        monthlyContributionInterest,
        monthlyContributionAmount:
          monthlyContributionInterest === "YES" ? monthlyContributionAmount! : null,
        status: "PENDING",
      },
      update: {
        name,
        passwordHash: await hashPassword(password),
        orgName: workspaceName,
        website: website || null,
        phone: phone || null,
        monthlyContributionInterest,
        monthlyContributionAmount:
          monthlyContributionInterest === "YES" ? monthlyContributionAmount! : null,
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

  const passwordHash = await hashPassword(password);
  let workspaceId = "";
  let userId = "";
  try {
    const workspace = await db.workspace.create({
      data: {
        name: workspaceName,
        slug,
        website: website || null,
        phone: phone || null,
        monthlyContributionInterest,
        monthlyContributionAmount:
          monthlyContributionInterest === "YES" ? monthlyContributionAmount! : null,
      },
    });
    workspaceId = workspace.id;

    const user = await db.user.create({
      data: { email: email.toLowerCase(), name, passwordHash },
    });
    userId = user.id;

    await db.membership.create({
      data: { userId: user.id, workspaceId: workspace.id, role: "ADMIN" },
    });
  } catch (error) {
    // Neon HTTP does not support transactions. Remove any partial signup rows.
    if (userId) {
      try {
        await db.user.deleteMany({ where: { id: userId } });
      } catch (cleanupError) {
        console.error("[signUpAction] user cleanup failed", cleanupError);
      }
    }
    if (workspaceId) {
      try {
        await db.workspace.deleteMany({ where: { id: workspaceId } });
      } catch (cleanupError) {
        console.error("[signUpAction] workspace cleanup failed", cleanupError);
      }
    }
    throw error;
  }

  await createSession(userId);
  await setWorkspaceCookie(workspaceId);
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

  try {
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return { error: "Identifiants incorrects." };
    }
    const membership = await db.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { workspaceId: true },
    });
    await createSession(user.id);
    if (membership) await setWorkspaceCookie(membership.workspaceId);
  } catch (e) {
    console.error("[signInAction]", e);
    return { error: "Service temporairement indisponible, veuillez réessayer." };
  }
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

export async function acceptWorkspaceInvitationAction(_prev: unknown, formData: FormData): Promise<{ error?: string }> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invitation = await db.workspaceInvitation.findUnique({ where: { tokenHash } });
  if (!invitation || invitation.expiresAt <= new Date()) return { error: "Cette invitation est invalide ou expirée." };
  let user = await db.user.findUnique({ where: { email: invitation.email } });
  if (user) {
    const session = await getSession();
    if (session?.user.id !== user.id) return { error: "Connectez-vous avec l’adresse invitée, puis rouvrez ce lien." };
    await db.membership.upsert({ where: { userId_workspaceId: { userId: user.id, workspaceId: invitation.workspaceId } }, create: { userId: user.id, workspaceId: invitation.workspaceId, role: invitation.role }, update: {} });
  } else {
    if (password.length < 8) return { error: "Choisissez un mot de passe d’au moins 8 caractères." };
    user = await db.user.create({ data: {
      email: invitation.email,
      name: invitation.name,
      passwordHash: await hashPassword(password),
      memberships: { create: { workspaceId: invitation.workspaceId, role: invitation.role } },
    } });
  }
  await db.workspaceInvitation.delete({ where: { id: invitation.id } });
  await createSession(user.id);
  await setWorkspaceCookie(invitation.workspaceId);
  redirect("/contacts");
}

export async function switchWorkspaceAction(workspaceId: string) {
  await setWorkspaceCookie(workspaceId);
}

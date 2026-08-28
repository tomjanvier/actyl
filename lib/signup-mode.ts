import "server-only";
import { db } from "@/lib/db";

export type SignupMode = "OPEN" | "APPROVAL";

/**
 * Signup mode resolution order:
 * 1. DB setting `signup_mode` (toggleable by admins at runtime)
 * 2. env SIGNUP_MODE
 * 3. valeur par défaut : OPEN
 */
export async function getSignupMode(): Promise<SignupMode> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: "signup_mode" } });
    if (row?.value === "APPROVAL" || row?.value === "OPEN") return row.value;
  } catch {}
  const fromEnv = process.env.SIGNUP_MODE;
  if (fromEnv === "APPROVAL") return "APPROVAL";
  return "OPEN";
}

export async function setSignupMode(mode: SignupMode): Promise<void> {
  await db.appSetting.upsert({
    where: { key: "signup_mode" },
    create: { key: "signup_mode", value: mode },
    update: { value: mode },
  });
}

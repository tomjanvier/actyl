import "server-only";
import { db } from "@/lib/db";

/**
 * Per-workspace feature flags stored in AppSetting.
 * `extended_directory` enables the people segments (adhérents, bénévoles,
 * donateurs, soutiens) in the sidebar and contacts directory.
 */
export async function getExtendedDirectory(): Promise<boolean> {
  const row = await db.appSetting.findUnique({
    where: { key: "extended_directory" },
  });
  return row?.value === "on";
}

export const CONTACT_CATEGORIES = [
  { key: "DECISION_MAKER", label: "Décideur·e·ses", icon: "landmark" },
  { key: "MEMBER", label: "Adhérent·e·s", icon: "users" },
  { key: "VOLUNTEER", label: "Bénévoles", icon: "heart-handshake" },
  { key: "DONOR", label: "Donateur·ice·s", icon: "gift" },
  { key: "SUPPORTER", label: "Soutiens", icon: "megaphone" },
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]["key"];

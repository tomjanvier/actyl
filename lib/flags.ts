import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { workspaceSettingKey } from "@/lib/workspace-settings";

/** Réglages fonctionnels isolés par espace dans AppSetting. */
export const SEGMENT_SETTING_KEYS = {
  decisionMaker: "extended_decision_maker",
  members: "extended_members",
  volunteers: "extended_volunteers",
  donors: "extended_donors",
  supporters: "extended_supporters",
} as const;

export type SegmentsConfig = Record<keyof typeof SEGMENT_SETTING_KEYS, boolean>;

/** Lit les segments tout en conservant la compatibilité avec l'ancien réglage global. */
export const getSegmentsConfig = cache(async (workspaceId: string): Promise<SegmentsConfig> => {
  const settingNames = ["extended_directory", ...Object.values(SEGMENT_SETTING_KEYS)];
  const scopedKeys = settingNames.map((key) => workspaceSettingKey(workspaceId, key));
  const rows = await db.appSetting.findMany({
    where: { key: { in: scopedKeys } },
  });
  const prefix = `${workspaceId}:`;
  const values = Object.fromEntries(rows.map((row) => [row.key.replace(prefix, ""), row.value]));

  // Compatibilité en lecture : aucune migration ni écriture pendant le rendu.
  if (rows.length === 0) {
    const [legacy, firstWorkspace] = await Promise.all([
      db.appSetting.findUnique({ where: { key: "extended_directory" } }),
      db.workspace.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }),
    ]);
    if (legacy?.value === "on" && firstWorkspace?.id === workspaceId) {
      return {
        decisionMaker: true,
        members: true,
        volunteers: true,
        donors: true,
        supporters: true,
      };
    }
  }

  const legacy = values.extended_directory === "on";
  return {
    decisionMaker: true,
    members: values.extended_members === "on" || legacy,
    volunteers: values.extended_volunteers === "on" || legacy,
    donors: values.extended_donors === "on" || legacy,
    supporters: values.extended_supporters === "on" || legacy,
  };
});

export const CONTACT_CATEGORIES = [
  { key: "DECISION_MAKER", label: "Décideur·e·ses", icon: "landmark" },
  { key: "MEMBER", label: "Adhérent·e·s", icon: "users" },
  { key: "VOLUNTEER", label: "Bénévoles", icon: "heart-handshake" },
  { key: "DONOR", label: "Donateur·ice·s", icon: "gift" },
  { key: "SUPPORTER", label: "Soutiens", icon: "megaphone" },
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]["key"];

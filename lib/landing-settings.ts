import "server-only";

import { db } from "@/lib/db";

export const LANDING_DEFAULTS = {
  heroTitle: "Le CRM de plaidoyer pensé pour les",
  heroHighlight: "associations et ONG",
  heroText:
    "Organisez vos campagnes de lobbying, suivez chaque décideur dans un pipeline visuel, partagez vos annuaires et mobilisez des milliers de citoyens par email — le tout dans une interface rapide et keyboard-first.",
  primaryCta: "Créer mon espace de travail",
  primaryHref: "/sign-up",
  footerText: "Actyl — construit par et pour les plaidoyers citoyens.",
} as const;

export type LandingSettings = {
  [Key in keyof typeof LANDING_DEFAULTS]: string;
};

const landingKeys = Object.keys(LANDING_DEFAULTS) as Array<keyof LandingSettings>;

/** Charge la configuration globale de la page publique avec des valeurs sûres. */
export async function getLandingSettings(): Promise<LandingSettings> {
  try {
    const rows = await db.appSetting.findMany({
      where: { key: { in: landingKeys.map((key) => `landing_${key}`) } },
      select: { key: true, value: true },
    });
    const values = new Map(rows.map((row) => [row.key, row.value]));
    return Object.fromEntries(
      landingKeys.map((key) => [
        key,
        values.get(`landing_${key}`) || LANDING_DEFAULTS[key],
      ]),
    ) as LandingSettings;
  } catch {
    // La page publique reste disponible pendant un réveil ou incident de base.
    return { ...LANDING_DEFAULTS };
  }
}

import "server-only";

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

export const LANDING_DEFAULTS = {
  heroTitle: "Le CRM de plaidoyer pensé pour les",
  heroHighlight: "associations et ONG",
  heroText:
    "Organisez vos campagnes de lobbying, suivez chaque décideur dans un pipeline visuel, partagez vos annuaires et mobilisez des milliers de citoyens par email — le tout dans une interface rapide et keyboard-first.",
  primaryCta: "Créer mon espace de travail",
  primaryHref: "/sign-up",
  directoryTitle: "Un annuaire des décideurs, en accès direct",
  directoryText: "Recherchez et filtrez les contacts d’une liste publique, sans créer de compte.",
  feature1Title: "Annuaire des décideurs",
  feature1Text: "Députés, sénateurs, eurodéputés, maires, patrons, presse : une base centralisée avec champs personnalisés, positions et scores d'influence.",
  feature2Title: "Pipeline kanban",
  feature2Text: "Glissez-déposez chaque cible de « À contacter » à « Officiellement gagné·e ». Chaque mouvement est horodaté dans l'historique.",
  feature3Title: "Interpellation citoyenne",
  feature3Text: "Une page publique par campagne : vos soutiens envoient en un clic des messages personnalisés aux décideurs cibles.",
  feature4Title: "Rôles granulaires",
  feature4Text: "Admins, responsables campagne, militant·e·s, observateur·rice·s — chacun voit et fait exactement ce qu'il faut.",
  feature5Title: "Pétitions publiques",
  feature5Text: "Une page de signature par campagne avec objectif, barre de progression et liste des derniers signataires.",
  feature6Title: "Événements & RSVP",
  feature6Text: "Réunions publiques, porte-à-porte, formations : publiez, suivez les inscriptions et mobilisez vos équipes.",
  footerText: "Actyl — construit par et pour les plaidoyers citoyens.",
} as const;

export type LandingSettings = {
  [Key in keyof typeof LANDING_DEFAULTS]: string;
};

const landingKeys = Object.keys(LANDING_DEFAULTS) as Array<keyof LandingSettings>;

/** Charge la configuration globale de la page publique avec des valeurs sûres. */
export async function getLandingSettings(): Promise<LandingSettings> {
  try {
    const rows = await loadLandingSettings();
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

const loadLandingSettings = unstable_cache(
  () => db.appSetting.findMany({
    where: { key: { in: landingKeys.map((key) => `landing_${key}`) } },
    select: { key: true, value: true },
  }),
  ["landing-settings-v1"],
  { revalidate: 60, tags: ["landing-settings"] },
);

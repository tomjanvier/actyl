/**
 * Pack de référence « Présidentielle 2027 ».
 *
 * Instantané éditorial (état au 25 août 2026, sources : presse nationale).
 * Non exhaustif : le paysage reste fragmenté (~24 candidat·e·s déclaré·e·s
 * recensé·e·s par Le Monde au 19/08/2026, plus une dizaine de potentiel·le·s).
 * La liste est un point de départ : chaque espace peut l'enrichir librement,
 * et la resynchronisation n'écrase jamais les modifications locales.
 *
 * Scrutin : dimanches 18 avril et 2 mai 2027.
 * Primaire social-démocrate : 11 et 18 octobre 2026.
 */

export const PRESIDENTIELLE_PACK_KEY = "presidentielle-2027";

export type PackPerson = {
  firstName: string;
  lastName: string;
  /** Parti ou mouvement politique principal. */
  party: string | null;
  /** "Candidat·e déclaré·e" | "Candidat·e potentiel·le". */
  title: string;
  /** Note affichée dans la liste (date de déclaration, citation…). */
  note: string;
};

export type PackListDef = {
  key: string;
  name: string;
  description: string;
  emoji: string;
  publishedByDefault: boolean;
  people: PackPerson[];
};

const DECLARE = "Candidat·e déclaré·e";
const POTENTIAL = "Candidat·e potentiel·le";

export const PRESIDENTIELLE_LISTS: PackListDef[] = [
  {
    key: `${PRESIDENTIELLE_PACK_KEY}-candidats`,
    name: "Présidentielle 2027 — Candidat·e·s",
    description:
      "Candidat·e·s déclaré·e·s et personnalités pressenties pour l'élection présidentielle (18 avril et 2 mai 2027). État au 25 août 2026 — non exhaustif, à tenir à jour.",
    emoji: "🗳️",
    publishedByDefault: true,
    people: [
      // ── Bloc central ──────────────────────────────────────────────────────
      {
        firstName: "Gabriel",
        lastName: "Attal",
        party: "Renaissance",
        title: DECLARE,
        note: "Figure du bloc central pour succéder à Emmanuel Macron.",
      },
      {
        firstName: "Édouard",
        lastName: "Philippe",
        party: "Horizons",
        title: DECLARE,
        note: "Déclaré le 3 septembre 2024 (Le Point). Ancien Premier ministre, maire du Havre.",
      },
      {
        firstName: "Olivier",
        lastName: "Becht",
        party: "Ensemble pour la République (app.)",
        title: DECLARE,
        note: "Député du Haut-Rhin, candidature annoncée à la presse régionale.",
      },
      {
        firstName: "Gérald",
        lastName: "Darmanin",
        party: "Renaissance",
        title: POTENTIAL,
        note: "Pressenti dans le bloc central.",
      },
      // ── Gauche ────────────────────────────────────────────────────────────
      {
        firstName: "Jean-Luc",
        lastName: "Mélenchon",
        party: "La France insoumise",
        title: DECLARE,
        note: "Déclaré le 3 mai 2026 — quatrième candidature. Campagne lancée le 23 août 2026.",
      },
      {
        firstName: "Raphaël",
        lastName: "Glucksmann",
        party: "Place publique",
        title: DECLARE,
        note: "Déclaré le 23 août 2026 (20h TF1) ; participe à la primaire social-démocrate d'octobre.",
      },
      {
        firstName: "Ségolène",
        lastName: "Royal",
        party: "Parti socialiste",
        title: DECLARE,
        note: "Candidate à la présidentielle et à la primaire PS d'octobre 2026.",
      },
      {
        firstName: "Philippe",
        lastName: "Brun",
        party: "Parti socialiste",
        title: DECLARE,
        note: "Député (PS), candidat à la primaire social-démocrate.",
      },
      {
        firstName: "Jérôme",
        lastName: "Guedj",
        party: "Parti socialiste",
        title: DECLARE,
        note: "Déclaré le 5 février 2026. Député de l'Essonne (PS).",
      },
      {
        firstName: "Karim",
        lastName: "Bouamrane",
        party: "Parti socialiste",
        title: DECLARE,
        note: "Déclaré le 9 juin 2026. Maire de Saint-Ouen.",
      },
      {
        firstName: "Delphine",
        lastName: "Batho",
        party: "Génération Écologie",
        title: DECLARE,
        note: "Déclarée le 25 novembre 2025. Députée des Deux-Sèvres, hors primaire PS.",
      },
      {
        firstName: "Marine",
        lastName: "Tondelier",
        party: "Les Écologistes",
        title: POTENTIAL,
        note: "Secrétaire nationale des Écologistes ; hors primaire PS.",
      },
      {
        firstName: "François",
        lastName: "Ruffin",
        party: "Sans étiquette (ex-LFI)",
        title: POTENTIAL,
        note: "Pressenti à gauche.",
      },
      {
        firstName: "Clémentine",
        lastName: "Autain",
        party: "L'Après (ex-LFI)",
        title: POTENTIAL,
        note: "Pressentie à gauche.",
      },
      {
        firstName: "Olivier",
        lastName: "Faure",
        party: "Parti socialiste",
        title: POTENTIAL,
        note: "Premier secrétaire du PS ; n'exclut pas d'être candidat.",
      },
      {
        firstName: "Nathalie",
        lastName: "Arthaud",
        party: "Lutte ouvrière",
        title: DECLARE,
        note: "Porte-parole de LO ; 4ᵉ candidature consécutive.",
      },
      {
        firstName: "Anasse",
        lastName: "Kazib",
        party: "Révolution permanente",
        title: DECLARE,
        note: "Cheminateur ferroviaire, candidature anticapitaliste.",
      },
      {
        firstName: "Selma",
        lastName: "Labib",
        party: "NPA-Révolutionnaires",
        title: DECLARE,
        note: "Candidature trotskiste.",
      },
      // ── Droite ────────────────────────────────────────────────────────────
      {
        firstName: "Michel",
        lastName: "Barnier",
        party: "Les Républicains",
        title: POTENTIAL,
        note: "« Je me sens capable d'être président » (19 avril 2026). Ancien Premier ministre.",
      },
      {
        firstName: "Xavier",
        lastName: "Bertrand",
        party: "Nous France",
        title: POTENTIAL,
        note: "« Je me prépare à cette élection » (BFMTV, 14 juin 2026). Président des Hauts-de-France.",
      },
      {
        firstName: "Bruno",
        lastName: "Retailleau",
        party: "Les Républicains",
        title: POTENTIAL,
        note: "Pressenti à droite.",
      },
      // ── Extrême droite / souverainistes ───────────────────────────────────
      {
        firstName: "Marine",
        lastName: "Le Pen",
        party: "Rassemblement national",
        title: DECLARE,
        note: "Déclarée le 7 juillet 2026 (TF1) ; condamnation en appel suspendue par le pourvoi.",
      },
      {
        firstName: "Jordan",
        lastName: "Bardella",
        party: "Rassemblement national",
        title: POTENTIAL,
        note: "Président du RN ; candidat de substitution en cas d'inéligibilité.",
      },
      {
        firstName: "Éric",
        lastName: "Zemmour",
        party: "Reconquête !",
        title: POTENTIAL,
        note: "« S'il n'y a pas de primaire [à droite], je serai candidat » (RTL, 3 mai 2026).",
      },
      {
        firstName: "Nicolas",
        lastName: "Dupont-Aignan",
        party: "Debout la France",
        title: DECLARE,
        note: "Candidature annoncée ; se retire si Philippe de Villiers se lance.",
      },
      // ── Autres candidatures déclarées ─────────────────────────────────────
      {
        firstName: "Florian",
        lastName: "Philippot",
        party: "Les Patriotes",
        title: DECLARE,
        note: "Déclaré le 9 mars 2026.",
      },
      {
        firstName: "François",
        lastName: "Asselineau",
        party: "Union populaire républicaine",
        title: DECLARE,
        note: "Déclaré le 21 mars 2026 — sortie de l'UE.",
      },
      {
        firstName: "Juan",
        lastName: "Branco",
        party: "Sans étiquette",
        title: DECLARE,
        note: "Avocat et essayiste, candidat depuis le 19 décembre 2025.",
      },
      {
        firstName: "Clara",
        lastName: "Egger",
        party: "Solution démocratique",
        title: DECLARE,
        note: "Enseignante-chercheuse, candidate écologiste sociale.",
      },
      {
        firstName: "Antoine",
        lastName: "Mikolajczak",
        party: "Équinoxe",
        title: DECLARE,
        note: "Déclaré le 27 juin 2026 devant les adhérents.",
      },
      {
        firstName: "Francis",
        lastName: "Lalanne",
        party: "Sans étiquette",
        title: DECLARE,
        note: "Chanteur, candidature médiatique.",
      },
      {
        firstName: "Benoît",
        lastName: "Mathieu",
        party: "Sans étiquette",
        title: DECLARE,
        note: "Candidature citoyenne.",
      },
    ],
  },
];

/** Dates clés affichées sur la page du module. */
export const PRESIDENTIELLE_DATES: Array<{ label: string; date: string }> = [
  { label: "Primaire social-démocrate", date: "11 & 18 octobre 2026" },
  { label: "1ᵉʳ tour", date: "dimanche 18 avril 2027" },
  { label: "2ᵉ tour", date: "dimanche 2 mai 2027" },
];

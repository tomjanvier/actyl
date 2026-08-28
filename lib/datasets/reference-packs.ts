export type ReferencePackKey = "deputes" | "senateurs" | "europeennes" | "presidentielle-2027" | "paris" | "regions" | "departements";

export type ReferencePack = {
  key: ReferencePackKey;
  name: string;
  description: string;
  expected: string;
  source: "an" | "senat" | "pe" | "presidentielle" | "paris" | "regions" | "departements";
};

export const REFERENCE_PACKS: ReferencePack[] = [
  { key: "deputes", name: "Député·e·s", description: "Assemblée nationale", expected: "577 sièges", source: "an" },
  { key: "senateurs", name: "Sénateur·rice·s", description: "Sénat", expected: "348 sièges", source: "senat" },
  { key: "europeennes", name: "Eurodéputé·e·s", description: "Parlement européen — délégation française", expected: "81 sièges", source: "pe" },
  { key: "presidentielle-2027", name: "Présidentielle 2027", description: "Candidat·e·s au scrutin présidentiel", expected: "pack de référence", source: "presidentielle" },
  { key: "paris", name: "Élu·e·s de Paris", description: "Conseil de Paris — Paris Data", expected: "mandature en cours", source: "paris" },
  { key: "regions", name: "Élu·e·s régionaux", description: "Répertoire national des élus", expected: "conseils régionaux", source: "regions" },
  { key: "departements", name: "Élu·e·s départementaux", description: "Répertoire national des élus", expected: "conseils départementaux", source: "departements" },
];

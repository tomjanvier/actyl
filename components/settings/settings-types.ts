export type ReferenceSource =
  | "an"
  | "senat"
  | "pe"
  | "presidentielle"
  | "paris"
  | "regions"
  | "departements";

export type RoleMeta = Record<
  string,
  { label: string; description: string; badge: string }
>;


// ── Domain vocabulary (labels, colors, option lists) ─────────────────────────

export const ROLES = ["ADMIN", "CAMPAIGNER", "MEMBER", "OBSERVER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_META: Record<
  Role,
  { label: string; description: string; badge: string }
> = {
  ADMIN: {
    label: "Admin",
    description:
      "Accès total : schéma, champs personnalisés, membres, rôles, suppression.",
    badge: "bg-rose-500/10 text-rose-400 ring-rose-500/20",
  },
  CAMPAIGNER: {
    label: "Responsable campagne",
    description:
      "Crée des campagnes, gère les listes partagées, déclenche les envois d'emails.",
    badge: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/20",
  },
  MEMBER: {
    label: "Militant·e",
    description:
      "Consulte les listes, met à jour les statuts, ajoute des notes privées.",
    badge: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
  },
  OBSERVER: {
    label: "Observateur·rice",
    description: "Lecture seule sur tout l'espace de travail.",
    badge: "bg-zinc-500/10 text-zinc-300 ring-zinc-500/20",
  },
};

export function can(role: Role | undefined, action: string): boolean {
  if (!role) return false;
  const matrix: Record<Role, string[]> = {
    ADMIN: ["*"],
    CAMPAIGNER: [
      "campaign:create", "campaign:edit", "campaign:delete",
      "card:create", "card:move", "card:edit", "card:delete",
      "list:create", "list:edit", "list:publish",
      "email:send", "template:manage",
      "contact:create", "contact:edit",
      "note:add",
    ],
    MEMBER: [
      "card:create", "card:move", "card:edit",
      "contact:create", "contact:edit",
      "list:create", "list:edit",
      "note:add",
    ],
    OBSERVER: [],
  };
  const perms = matrix[role];
  return perms.includes("*") || perms.includes(action);
}

// ── Taxonomie des contacts ───────────────────────────────────────────────────

export const LEVELS = [
  "EU", "NATIONAL", "REGIONAL", "LOCAL",
  "PRIVATE_SECTOR", "MEDIA", "CIVIL_SOCIETY",
] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_META: Record<Level, { label: string; short: string }> = {
  EU: { label: "Europe", short: "UE" },
  NATIONAL: { label: "National", short: "Nat." },
  REGIONAL: { label: "Régional", short: "Rég." },
  LOCAL: { label: "Local", short: "Loc." },
  PRIVATE_SECTOR: { label: "Secteur privé", short: "Privé" },
  MEDIA: { label: "Média / Presse", short: "Média" },
  CIVIL_SOCIETY: { label: "Société civile", short: "Soc." },
};

export const STANCES = [
  "ALLY", "FAVORABLE", "UNDECIDED", "TARGET", "OPPOSED", "UNKNOWN",
] as const;
export type Stance = (typeof STANCES)[number];

export const STANCE_META: Record<
  Stance,
  { label: string; dot: string; badge: string }
> = {
  ALLY: {
    label: "Allié·e",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  },
  FAVORABLE: {
    label: "Favorable",
    dot: "bg-emerald-400/70",
    badge: "bg-emerald-500/[0.07] text-emerald-300 ring-emerald-500/15",
  },
  UNDECIDED: {
    label: "Indécis·e",
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  },
  TARGET: {
    label: "Cible prioritaire",
    dot: "bg-orange-500",
    badge: "bg-orange-500/10 text-orange-400 ring-orange-500/20",
  },
  OPPOSED: {
    label: "Opposant·e",
    dot: "bg-rose-500",
    badge: "bg-rose-500/10 text-rose-400 ring-rose-500/20",
  },
  UNKNOWN: {
    label: "Position inconnue",
    dot: "bg-zinc-600",
    badge: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20",
  },
};

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_META: Record<
  Priority,
  { label: string; badge: string; order: number }
> = {
  URGENT: {
    label: "Urgent",
    badge: "bg-rose-500/10 text-rose-400 ring-rose-500/20",
    order: 0,
  },
  HIGH: {
    label: "Haute",
    badge: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    order: 1,
  },
  MEDIUM: {
    label: "Normale",
    badge: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
    order: 2,
  },
  LOW: {
    label: "Basse",
    badge: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20",
    order: 3,
  },
};

export const CAMPAIGN_STATUSES = [
  "PLANNING", "ACTIVE", "PAUSED", "WON", "LOST", "ARCHIVED",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_META: Record<
  CampaignStatus,
  { label: string; badge: string; dot: string }
> = {
  PLANNING: {
    label: "En préparation",
    badge: "bg-violet-500/10 text-violet-300 ring-violet-500/20",
    dot: "bg-violet-400",
  },
  ACTIVE: {
    label: "Active",
    badge: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/20",
    dot: "bg-indigo-400",
  },
  PAUSED: {
    label: "En pause",
    badge: "bg-zinc-500/10 text-zinc-300 ring-zinc-500/20",
    dot: "bg-zinc-400",
  },
  WON: {
    label: "Gagnée 🎉",
    badge: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
    dot: "bg-emerald-400",
  },
  LOST: {
    label: "Perdue",
    badge: "bg-rose-500/10 text-rose-300 ring-rose-500/20",
    dot: "bg-rose-400",
  },
  ARCHIVED: {
    label: "Archivée",
    badge: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20",
    dot: "bg-zinc-500",
  },
};

export const STAGE_KINDS = ["NEUTRAL", "POSITIVE", "NEGATIVE", "ACTIVE", "WON"] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

export const STAGE_KIND_META: Record<
  StageKind,
  { headerDot: string; headerText: string; glow: string }
> = {
  NEUTRAL: {
    headerDot: "bg-zinc-500",
    headerText: "text-zinc-300",
    glow: "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]",
  },
  POSITIVE: {
    headerDot: "bg-emerald-500",
    headerText: "text-emerald-300",
    glow: "",
  },
  NEGATIVE: {
    headerDot: "bg-rose-500",
    headerText: "text-rose-300",
    glow: "",
  },
  ACTIVE: {
    headerDot: "bg-indigo-500",
    headerText: "text-indigo-300",
    glow: "",
  },
  WON: {
    headerDot: "bg-emerald-400",
    headerText: "text-emerald-200",
    glow: "",
  },
};

export const CUSTOM_FIELD_TYPES = [
  "TEXT", "SELECT", "MULTI_SELECT", "NUMBER", "DATE", "RATING", "BOOLEAN", "URL",
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: "Texte",
  SELECT: "Liste déroulante",
  MULTI_SELECT: "Choix multiple",
  NUMBER: "Nombre",
  DATE: "Date",
  RATING: "Score d'influence (1–5)",
  BOOLEAN: "Oui / Non",
  URL: "Lien web",
};

export const AVATAR_COLORS: Record<string, string> = {
  slate: "bg-slate-600",
  indigo: "bg-indigo-600",
  emerald: "bg-emerald-600",
  amber: "bg-amber-600",
  rose: "bg-rose-600",
  violet: "bg-violet-600",
  sky: "bg-sky-600",
  teal: "bg-teal-600",
  orange: "bg-orange-600",
  fuchsia: "bg-fuchsia-600",
};

export const EMAIL_VARIABLES = [
  { key: "{{decision_maker_name}}", desc: "Nom complet du décideur" },
  { key: "{{decision_maker_first_name}}", desc: "Prénom du décideur" },
  { key: "{{decision_maker_title}}", desc: "Fonction exacte" },
  { key: "{{institution}}", desc: "Institution" },
  { key: "{{constituent_name}}", desc: "Nom de l'expéditeur citoyen" },
  { key: "{{constituent_city}}", desc: "Ville de l'expéditeur" },
  { key: "{{campaign_name}}", desc: "Nom de la campagne" },
] as const;

export const DEFAULT_STAGES: Array<{
  name: string;
  kind: StageKind;
}> = [
  { name: "À contacter", kind: "NEUTRAL" },
  { name: "Email envoyé", kind: "ACTIVE" },
  { name: "Rendez-vous programmé", kind: "ACTIVE" },
  { name: "Allié·e confirmé·e", kind: "POSITIVE" },
  { name: "Officiellement gagné·e", kind: "WON" },
  { name: "Opposant·e déclaré·e", kind: "NEGATIVE" },
];

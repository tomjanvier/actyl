import "server-only";
import { db } from "@/lib/db";

/**
 * Fusion « sans écrasement » de personnes dans une liste partagée.
 *
 * Règles :
 *  - un contact existant de l'annuaire (même prénom + nom + institution,
 *    comparaison insensible à la casse) n'est JAMAIS modifié ;
 *  - il est simplement rattaché à la liste s'il n'y figure pas déjà ;
 *  - les éléments déjà présents dans la liste sont conservés tels quels ;
 *  - seuls les contacts inconnus sont créés.
 */

export type MergePerson = {
  firstName: string;
  lastName: string;
  email?: string | null;
  photoUrl?: string | null;
  title?: string | null;
  institution?: string | null;
  party?: string | null;
  region?: string | null;
  level?: string;
  note?: string | null;
};

export type MergeStats = {
  created: number;
  linked: number;
  already: number;
  skipped: number;
};

const AVATAR_COLORS = [
  "slate", "indigo", "emerald", "amber", "rose",
  "violet", "sky", "teal", "orange", "fuchsia",
];

function norm(v: string | null | undefined): string {
  return (v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export { norm };

const VALID_LEVELS = new Set([
  "EU", "NATIONAL", "REGIONAL", "LOCAL",
  "PRIVATE_SECTOR", "MEDIA", "CIVIL_SOCIETY",
]);

function cleanPerson(p: MergePerson): MergePerson | null {
  const firstName = p.firstName?.trim() ?? "";
  const lastName = p.lastName?.trim() ?? "";
  if (!firstName && !lastName) return null;
  const level =
    p.level && VALID_LEVELS.has(p.level.toUpperCase())
      ? p.level.toUpperCase()
      : "NATIONAL";
  return {
    firstName: firstName || "(?)",
    lastName,
    email: p.email?.trim() || null,
    photoUrl: p.photoUrl?.trim() || null,
    title: p.title?.trim() || null,
    institution: p.institution?.trim() || null,
    party: p.party?.trim() || null,
    region: p.region?.trim() || null,
    level,
    note: p.note?.trim().slice(0, 300) || null,
  };
}

/**
 * Fusionne les personnes dans la liste sans toucher aux données existantes.
 * Les compteurs détaillés permettent à l'interface d'expliquer le résultat.
 */export async function mergePeopleIntoList(
  workspaceId: string,
  listId: string,
  people: MergePerson[],
): Promise<MergeStats> {
  // Indexe une seule fois l'annuaire de l'espace avec des clés normalisées.
  const existing = await db.contact.findMany({
    where: { workspaceId },
    select: { id: true, firstName: true, lastName: true, institution: true },
  });
  const index = new Map<string, string>();
  for (const c of existing) {
    index.set(`${norm(c.firstName)}|${norm(c.lastName)}|${norm(c.institution)}`, c.id);
  }

  const listItems = await db.listItem.findMany({
    where: { listId },
    select: { contactId: true },
  });
  const inList = new Set(listItems.map((i) => i.contactId));

  let colorCursor = Math.floor(Math.random() * AVATAR_COLORS.length);
  const stats: MergeStats = { created: 0, linked: 0, already: 0, skipped: 0 };

  for (const raw of people) {
    const person = cleanPerson(raw);
    if (!person || (!raw.firstName?.trim() && !raw.lastName?.trim())) {
      stats.skipped++;
      continue;
    }
    const key = `${norm(person.firstName)}|${norm(person.lastName)}|${norm(person.institution)}`;
    let contactId = index.get(key);

    if (!contactId) {
      // Crée uniquement une personne inconnue, sans écraser l'existant.
      const contact = await db.contact.create({
        data: {
          workspaceId,
          firstName: person.firstName,
          lastName: person.lastName,
          email: person.email,
          photoUrl: person.photoUrl,
          title: person.title,
          institution: person.institution,
          party: person.party,
          region: person.region,
          level: person.level,
          stance: "UNKNOWN",
          category: "DECISION_MAKER",
          influenceScore: 3,
          avatarColor: AVATAR_COLORS[colorCursor++ % AVATAR_COLORS.length]!,
        },
        select: { id: true },
      });
      contactId = contact.id;
      index.set(key, contactId);
      stats.created++;
    }

    if (inList.has(contactId)) {
      stats.already++;
      continue;
    }
    await db.listItem.create({
      data: { listId, contactId, note: person.note },
    });
    inList.add(contactId);
    stats.linked++;
  }

  return stats;
}

// ── CSV (collé ou fichier) ───────────────────────────────────────────────────

/** Analyse une ligne CSV, y compris les champs cités et les guillemets doublés. */
export function parseCsvLine(line: string, sep: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === sep) {
      cols.push(cur);
      cur = "";
    } else cur += c;
  }
  cols.push(cur);
  return cols;
}

const HEADER_ALIASES: Record<keyof MergePerson | "level", string[]> = {
  firstName: ["prenom", "prénom", "firstname", "first_name", "givenname"],
  lastName: ["nom", "nomusuel", "lastname", "last_name", "familyname"],
  email: ["email", "courriel", "mail", "mel"],
  photoUrl: ["photo", "photourl", "photo_url", "portrait"],
  title: ["fonction", "titre", "title", "qualite"],
  institution: ["institution", "organisation", "organisme"],
  party: ["parti", "partipolitique", "groupe", "mouvement"],
  region: ["region", "région", "circonscription", "territoire"],
  level: ["niveau", "level"],
  note: ["note", "remarque", "statut", "commentaire"],
};

/**
 * Convertit un CSV ou TSV collé en personnes. La première ligne non vide doit
 * être un en-tête ; l'ordre est libre et les colonnes inconnues sont ignorées.
 */
export function parseContactsCsv(text: string): MergePerson[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headerLine = lines[0]!.trim();
  // Retient le séparateur le plus fréquent dans l'en-tête.
  const sepCounts: Array<[string, number]> = [
    [";", (headerLine.match(/;/g) ?? []).length],
    [",", (headerLine.match(/,/g) ?? []).length],
    ["\t", (headerLine.match(/\t/g) ?? []).length],
  ];
  const sep = sepCounts.sort((a, b) => b[1] - a[1])[0]![1] > 0 ? sepCounts.sort((a, b) => b[1] - a[1])[0]![0] : ",";

  const headers = parseCsvLine(headerLine, sep).map((h) =>
    h
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, ""),
  );
  const colFor = new Map<string, number>();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const i = headers.findIndex((h) => h === alias);
      if (i >= 0 && !colFor.has(field)) colFor.set(field, i);
    }
  }
  if (!colFor.has("lastName") && !colFor.has("firstName")) return [];

  const out: MergePerson[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line, sep);
    const get = (field: string) => {
      const i = colFor.get(field);
      return i != null ? (cols[i]?.trim() ?? "") : "";
    };
    if (!get("firstName") && !get("lastName")) continue;
    out.push({
      firstName: get("firstName"),
      lastName: get("lastName"),
      email: get("email") || null,
      photoUrl: get("photoUrl") || null,
      title: get("title") || null,
      institution: get("institution") || null,
      party: get("party") || null,
      region: get("region") || null,
      level: get("level") || undefined,
      note: get("note") || null,
    });
  }
  return out;
}

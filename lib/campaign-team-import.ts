import { createHash } from "node:crypto";
import { db } from "@/lib/db";

type CsvRow = Record<string, string>;

const OFFICIAL_ORGANIZATION_SOURCES: Record<string, string> = {
  "jean luc melenchon": "https://lafranceinsoumise.fr/lfi-comment-ca-marche/",
  "marine tondelier": "https://lesecologistes.fr/posts/5nbYj591TiFofYUDETOxlB/congres-2025-tous-les-resultats",
  "olivier faure": "https://parti-socialiste.fr/communiques-de-presse/congres-du-parti-socialiste-les-delegues-ratifient-a-lunanimite-les-resultats-du-congres-et-confirment-olivier-faure-premier-secretaire/",
  "bruno retailleau": "https://republicains.fr/qui-sommes-nous/notre-equipe/",
  "fabien roussel": "https://www.pcf.fr/le_conseil_national_du_pcf_a_adopte_son_nouvel_executif_national",
};

export type CampaignTeamImportResult = {
  rows: number;
  teams: number;
  members: number;
  positions: number;
  contactsCreated: number;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Analyse un CSV complet, y compris les retours à la ligne dans les cellules. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  row.push(value.replace(/\r$/, ""));
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function toRows(text: string): CsvRow[] {
  const matrix = parseCsv(text.replace(/^\uFEFF/, ""));
  const headers = matrix.shift()?.map((header) => header.trim()) ?? [];
  return matrix.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""])),
  );
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts.shift() ?? "(?)",
    lastName: parts.join(" ") || "(?)",
  };
}

function candidateNames(value: string) {
  return value
    .split(/\s*\/\s*|\s*,\s*/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function teamStatus(value: string) {
  const status = normalize(value);
  if (status.includes("officiel")) return "OFFICIAL";
  if (status.includes("probable") || status.includes("pressenti")) return "LIKELY";
  if (status.includes("surveiller")) return "WATCH";
  return "UNKNOWN";
}

function sourceKey(...parts: Array<string | null | undefined>) {
  return createHash("sha256").update(parts.map(normalize).join("|")).digest("hex");
}

/**
 * Importe les rattachements de campagne sans stocker le fichier source ni les
 * notes libres. Les données déjà enrichies dans l'annuaire ne sont pas écrasées.
 */
export async function importCampaignTeamsCsv(
  workspaceId: string,
  csv: string,
  sourceLabel: string,
): Promise<CampaignTeamImportResult> {
  const rows = toRows(csv).filter(
    (row) => row.Nom && (row["Candidat associé"] || row["Équipe candidate"]),
  );
  if (!rows.length) throw new Error("Aucun rattachement de campagne reconnu dans ce fichier");
  if (rows.length > 2_000) throw new Error("Le fichier dépasse la limite de 2 000 lignes");

  return db.$transaction(async (tx) => {
    const existingContacts = await tx.contact.findMany({
      where: { workspaceId },
      select: { id: true, firstName: true, lastName: true, email: true, title: true, party: true },
    });
    const contactsByName = new Map(
      existingContacts.map((contact) => [normalize(`${contact.firstName} ${contact.lastName}`), contact]),
    );
    const contactsByEmail = new Map(
      existingContacts.filter((contact) => contact.email).map((contact) => [normalize(contact.email), contact]),
    );
    const candidateRows = new Map(rows.map((row) => [normalize(row.Nom), row]));
    const touchedTeams = new Set<string>();
    const touchedMembers = new Set<string>();
    const touchedPositions = new Set<string>();
    let contactsCreated = 0;

    async function ensureContact(name: string, row?: CsvRow) {
      const email = row?.Email?.trim() || null;
      const key = normalize(name);
      let contact = (email && contactsByEmail.get(normalize(email))) || contactsByName.get(key);
      if (!contact) {
        const parsed = splitName(name);
        contact = await tx.contact.create({
          data: {
            workspaceId,
            ...parsed,
            email,
            title: row?.Fonction || null,
            institution: "Présidentielle 2027",
            party: row?.["Étiquette parti"] || null,
            level: "NATIONAL",
            stance: "UNKNOWN",
            influenceScore: 3,
            avatarColor: "slate",
          },
          select: { id: true, firstName: true, lastName: true, email: true, title: true, party: true },
        });
        contactsCreated++;
        contactsByName.set(key, contact);
        if (email) contactsByEmail.set(normalize(email), contact);
      } else if (row && ((!contact.email && email) || (!contact.title && row.Fonction) || (!contact.party && row["Étiquette parti"]))) {
        contact = await tx.contact.update({
          where: { id: contact.id },
          data: {
            email: contact.email || email,
            title: contact.title || row.Fonction || null,
            party: contact.party || row["Étiquette parti"] || null,
          },
          select: { id: true, firstName: true, lastName: true, email: true, title: true, party: true },
        });
        contactsByName.set(key, contact);
      }
      return contact;
    }

    for (const row of rows) {
      const member = await ensureContact(row.Nom!, row);
      const associatedCandidates = candidateNames(
        row["Candidat associé"] || row["Équipe candidate"] || "",
      );
      for (const candidateName of associatedCandidates) {
        const candidateRow = candidateRows.get(normalize(candidateName));
        const candidate = await ensureContact(candidateName, candidateRow);
        const officialSourceUrl = OFFICIAL_ORGANIZATION_SOURCES[normalize(candidateName)] ?? null;
        const team = await tx.campaignTeam.upsert({
          where: {
            workspaceId_election_candidateName: {
              workspaceId,
              election: "Présidentielle 2027",
              candidateName,
            },
          },
          create: {
            workspaceId,
            name: `Équipe de ${candidateName}`,
            candidateName,
            candidateContactId: candidate.id,
            party: candidateRow?.["Étiquette parti"] || row["Étiquette parti"] || null,
            politicalBloc: candidateRow?.["Bloc politique"] || null,
            status: teamStatus(candidateRow?.["Statut 2027"] || ""),
            sourceLabel,
            sourceUrl: officialSourceUrl,
          },
          update: {
            candidateContactId: candidate.id,
            party: candidateRow?.["Étiquette parti"] || undefined,
            politicalBloc: candidateRow?.["Bloc politique"] || undefined,
            status: candidateRow ? teamStatus(candidateRow["Statut 2027"] || "") : undefined,
            sourceLabel,
            sourceUrl: officialSourceUrl || undefined,
          },
        });
        touchedTeams.add(team.id);

        const membership = await tx.campaignTeamMember.upsert({
          where: { teamId_contactId: { teamId: team.id, contactId: member.id } },
          create: {
            teamId: team.id,
            contactId: member.id,
            role: row.Fonction || null,
            involvement: row["Implication 2027"] || null,
            relationship: row["Lien avec candidat·e / parti"] || null,
            sourceLabel,
          },
          update: {
            role: row.Fonction || undefined,
            involvement: row["Implication 2027"] || undefined,
            relationship: row["Lien avec candidat·e / parti"] || undefined,
            sourceLabel,
          },
        });
        touchedMembers.add(membership.id);

        const angle = row["Angle SI"]?.trim();
        if (angle) {
          const key = sourceKey(sourceLabel, candidateName, row.Nom, angle);
          const position = await tx.politicalPosition.upsert({
            where: { workspaceId_sourceKey: { workspaceId, sourceKey: key } },
            create: {
              workspaceId,
              teamId: team.id,
              party: row["Étiquette parti"] || team.party,
              topic: "Solidarité internationale",
              summary: angle,
              evidence: row["Implication 2027"] || null,
              sourceLabel,
              sourceKey: key,
            },
            update: {
              teamId: team.id,
              party: row["Étiquette parti"] || team.party,
              summary: angle,
              evidence: row["Implication 2027"] || undefined,
              sourceLabel,
            },
          });
          touchedPositions.add(position.id);
        }
      }
    }

    return {
      rows: rows.length,
      teams: touchedTeams.size,
      members: touchedMembers.size,
      positions: touchedPositions.size,
      contactsCreated,
    };
  }, { timeout: 120_000 });
}

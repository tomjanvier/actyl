import "server-only";

import { db } from "@/lib/db";
import { PRESIDENTIELLE_LISTS } from "@/lib/datasets/presidentielle-2027";
import { REFERENCE_PACKS, type ReferencePackKey } from "@/lib/datasets/reference-packs";
import {
  importAssembleeNationale,
  importLocalElectedOfficials,
  importParlementEuropeen,
  importParisCouncillors,
  importSenat,
  type ImportedContact,
} from "@/lib/importers/officials";
import { norm, type MergePerson } from "@/lib/lists-import";
import { getDisabledReferencePacks } from "@/lib/reference-pack-settings";

const MINIMUM_SOURCE_SIZE: Record<ReferencePackKey, number> = {
  deputes: 400,
  senateurs: 250,
  europeennes: 50,
  "presidentielle-2027": 1,
  paris: 120,
  regions: 1_000,
  departements: 2_500,
};

const LIST_SYNC_CONCURRENCY = 4;

function identity(person: Pick<MergePerson, "firstName" | "lastName" | "institution">) {
  return `${norm(person.firstName)}|${norm(person.lastName)}|${norm(person.institution)}`;
}

function sourceIdentity(person: Pick<MergePerson, "sourceSystem" | "sourceId">) {
  return person.sourceSystem && person.sourceId
    ? `${norm(person.sourceSystem)}|${norm(person.sourceId)}`
    : null;
}

function toPeople(pack: ReferencePackKey, contacts: ImportedContact[]): MergePerson[] {
  return contacts.map((contact) => ({
    ...contact,
    note: `Synchronisation source publique — ${pack}`,
  }));
}

async function fetchPack(pack: ReferencePackKey): Promise<MergePerson[]> {
  let people: MergePerson[];
  if (pack === "presidentielle-2027") {
    people = PRESIDENTIELLE_LISTS.flatMap((list) =>
      list.people.map((person) => ({
        firstName: person.firstName,
        lastName: person.lastName,
        title: person.title,
        institution: "Présidentielle 2027",
        party: person.party,
        level: "NATIONAL",
        note: `Synchronisation source publique — ${pack}`,
      })),
    );
    // Les portraits sont enrichis depuis Wikipédia sans remplacer une photo
    // déjà saisie par une équipe. Une indisponibilité reste non bloquante.
    const enriched = await Promise.all(
      people.map(async (person) => ({ ...person, photoUrl: await wikipediaPhoto(person.firstName, person.lastName) })),
    );
    people = enriched;
  } else {
    const contacts =
      pack === "deputes"
        ? await importAssembleeNationale()
        : pack === "senateurs"
          ? await importSenat()
          : pack === "europeennes"
            ? await importParlementEuropeen()
            : pack === "paris"
              ? await importParisCouncillors()
              : await importLocalElectedOfficials(
                  pack === "regions" ? "regions" : "departements",
                );
    people = toPeople(pack, contacts);
  }

  const unique = new Map<string, MergePerson>();
  for (const person of people) {
    unique.set(sourceIdentity(person) ?? identity(person), person);
  }
  const result = [...unique.values()];
  if (result.length < MINIMUM_SOURCE_SIZE[pack]) {
    throw new Error(
      `Source ${pack} anormalement incomplète (${result.length} entrées) ; aucune proposition créée`,
    );
  }
  return result;
}

async function wikipediaPhoto(firstName: string, lastName: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(
      `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(`${firstName} ${lastName}`)}`,
      { headers: { Accept: "application/json", "User-Agent": "Actyl/1.0 (open-source advocacy CRM)" }, signal: controller.signal, cache: "no-store" },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { thumbnail?: { source?: string } };
    return data.thumbnail?.source ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

type CurrentContact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  photoUrl: string | null;
  title: string | null;
  institution: string | null;
  party: string | null;
  region: string | null;
  level: string;
  sourceSystem: string | null;
  sourceId: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  mastodonUrl: string | null;
};

function changed(person: MergePerson, contact: CurrentContact) {
  return ([
    "firstName",
    "lastName",
    "email",
    "photoUrl",
    "title",
    "institution",
    "party",
    "region",
    "level",
    "sourceSystem",
    "sourceId",
    "facebookUrl",
    "instagramUrl",
    "youtubeUrl",
    "mastodonUrl",
  ] as const)
    .some((field) => String(person[field] ?? "") !== String(contact[field] ?? ""));
}

/** Compare une liste à sa source et crée uniquement des propositions à valider. */
export async function syncReferenceListProposals(
  listId: string,
  workspaceId: string,
  pack: ReferencePackKey,
  sourcePeople?: MergePerson[],
) {
  const people = sourcePeople ?? (await fetchPack(pack));
  const [list, pending] = await Promise.all([
    db.sharedList.findFirst({
      where: { id: listId, workspaceId, sourcePack: pack },
      include: {
        items: {
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                photoUrl: true,
                title: true,
                institution: true,
                party: true,
                region: true,
                level: true,
                sourceSystem: true,
                sourceId: true,
                facebookUrl: true,
                instagramUrl: true,
                youtubeUrl: true,
                mastodonUrl: true,
              },
            },
          },
        },
      },
    }),
    db.listChangeProposal.findMany({
      where: { listId, workspaceId, status: "PENDING" },
      select: { action: true, contactId: true, payload: true },
    }),
  ]);
  if (!list) return { proposals: 0 };

  const pendingContacts = new Set(
    pending.filter((proposal) => proposal.contactId).map((proposal) =>
      `${proposal.action}:${proposal.contactId}`,
    ),
  );
  const pendingAdds = new Set(
    pending.filter((proposal) => proposal.action === "ADD").map((proposal) => proposal.payload),
  );
  const currentByIdentity = new Map(
    list.items.map((item) => [identity(item.contact), item.contact]),
  );
  const currentBySource = new Map(
    list.items.flatMap((item) => {
      const key = sourceIdentity(item.contact);
      return key ? [[key, item.contact] as const] : [];
    }),
  );
  const remaining = new Map(
    list.items.map((item) => [item.contact.id, item.contact]),
  );
  const proposals: Array<{
    listId: string;
    workspaceId: string;
    authorId: null;
    contactId: string | null;
    action: string;
    origin: string;
    payload: string;
    reason: string;
  }> = [];

  for (const person of people) {
    const key = identity(person);
    const stableKey = sourceIdentity(person);
    const contact =
      (stableKey ? currentBySource.get(stableKey) : undefined) ??
      currentByIdentity.get(key);
    const payload = JSON.stringify(person);
    if (!contact) {
      if (!pendingAdds.has(payload)) {
        proposals.push({
          listId,
          workspaceId,
          authorId: null,
          contactId: null,
          action: "ADD",
          origin: "PUBLIC_SOURCE",
          payload,
          reason: "Nouvelle entrée détectée dans la source publique",
        });
      }
      continue;
    }
    if (changed(person, contact) && !pendingContacts.has(`UPDATE:${contact.id}`)) {
      proposals.push({
        listId,
        workspaceId,
        authorId: null,
        contactId: contact.id,
        action: "UPDATE",
        origin: "PUBLIC_SOURCE",
        payload,
        reason: "Modification détectée dans la source publique",
      });
    }
    remaining.delete(contact.id);
  }

  for (const contact of remaining.values()) {
    if (pendingContacts.has(`REMOVE:${contact.id}`)) continue;
    proposals.push({
      listId,
      workspaceId,
      authorId: null,
      contactId: contact.id,
      action: "REMOVE",
      origin: "PUBLIC_SOURCE",
      payload: JSON.stringify(contact),
      reason: "Entrée absente de la source publique actuelle — retrait à confirmer",
    });
  }

  if (proposals.length) await db.listChangeProposal.createMany({ data: proposals });
  return { proposals: proposals.length };
}

/** Synchronise chaque pack installé en mutualisant un téléchargement par source. */
export async function syncAllReferenceLists() {
  const installedLists = await db.sharedList.findMany({
    where: { sourcePack: { in: REFERENCE_PACKS.map((pack) => pack.key) } },
    select: { id: true, workspaceId: true, sourcePack: true },
  });
  const workspaceIds = [...new Set(installedLists.map((list) => list.workspaceId))];
  const disabledByWorkspace = new Map(
    await Promise.all(
      workspaceIds.map(async (workspaceId) => [
        workspaceId,
        await getDisabledReferencePacks(workspaceId),
      ] as const),
    ),
  );
  const lists = installedLists.filter(
    (list) =>
      list.sourcePack &&
      !disabledByWorkspace
        .get(list.workspaceId)
        ?.has(list.sourcePack as ReferencePackKey),
  );
  const results = await Promise.all(REFERENCE_PACKS.map(async (definition) => {
    const packLists = lists.filter((list) => list.sourcePack === definition.key);
    if (!packLists.length) return { proposals: 0, error: null };
    try {
      const people = await fetchPack(definition.key);
      let proposals = 0;
      for (let index = 0; index < packLists.length; index += LIST_SYNC_CONCURRENCY) {
        const batch = packLists.slice(index, index + LIST_SYNC_CONCURRENCY);
        const synced = await Promise.all(
          batch.map((list) =>
            syncReferenceListProposals(
              list.id,
              list.workspaceId,
              definition.key,
              people,
            ),
          ),
        );
        proposals += synced.reduce((total, result) => total + result.proposals, 0);
      }
      return { proposals, error: null };
    } catch (error) {
      return {
        proposals: 0,
        error: {
          pack: definition.key,
          error: error instanceof Error ? error.message : "Source indisponible",
        },
      };
    }
  }));
  const proposals = results.reduce((total, result) => total + result.proposals, 0);
  const errors = results
    .map((result) => result.error)
    .filter((error): error is { pack: ReferencePackKey; error: string } => !!error);
  return { lists: lists.length, proposals, errors };
}

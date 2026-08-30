/* eslint-disable @typescript-eslint/no-explicit-any */
import { unzipSync } from "fflate";

export type ImportedContact = {
  firstName: string;
  lastName: string;
  email: string | null;
  photoUrl: string | null;
  title: string;
  institution: string;
  party: string | null;
  region: string | null;
  level: string; // EU | NATIONAL | REGIONAL | LOCAL
};

const UA = { "User-Agent": "Actyl/1.0 (open-source advocacy CRM)" };

function ensureMinimum(source: string, contacts: ImportedContact[], minimum: number) {
  if (contacts.length < minimum) {
    throw new Error(`${source} a renvoyé seulement ${contacts.length} entrées ; import interrompu`);
  }
  return contacts;
}

async function fetchWithTimeout(url: string, init?: RequestInit, ms = 60_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { ...UA, ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } finally {
    clearTimeout(t);
  }
}

// ── Assemblée nationale (open data officielle AMO10) ────────────────────────

const AN_ZIP =
  "https://data.assemblee-nationale.fr/static/openData/repository/17/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip";

export async function importAssembleeNationale(): Promise<ImportedContact[]> {
  const res = await fetchWithTimeout(AN_ZIP, {}, 180_000);
  if (!res.ok) throw new Error(`Téléchargement AN impossible (${res.status})`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(buf);

  // Index des organes par identifiant pour retrouver les groupes politiques.
  const organes = new Map<string, { codeType: string; libelle: string }>();
  for (const [name, data] of Object.entries(files)) {
    if (!name.includes("/organe/") || !name.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(new TextDecoder().decode(data));
      const o = parsed?.organe;
      if (o?.uid)
        organes.set(o.uid, {
          codeType: o.codeType ?? "",
          libelle: o.libelle ?? o.libelleAbrev ?? "",
        });
    } catch {}
  }

  const out: ImportedContact[] = [];
  for (const [name, data] of Object.entries(files)) {
    if (!name.includes("/acteur/") || !name.endsWith(".json")) continue;
    let a: any;
    try {
      a = JSON.parse(new TextDecoder().decode(data))?.acteur;
    } catch {
      continue;
    }
    const ident = a?.etatCivil?.ident;
    if (!ident?.nom) continue;

    const mandats: any[] =
      a?.mandats?.mandat ??
      (Array.isArray(a?.mandats) ? a.mandats : []);
    let circo: string | null = null;
    let groupe: string | null = null;
    for (const m of mandats) {
      const refs: string[] = [];
      const raw = m?.organes?.organeRef;
      if (typeof raw === "string") refs.push(raw);
      else if (Array.isArray(raw)) refs.push(...raw.map(String));
      for (const ref of refs) {
        const org = organes.get(ref);
        if (org?.codeType === "GP" && !groupe) groupe = org.libelle;
      }
      const lieu = m?.election?.lieu;
      if (lieu?.departement && lieu?.numCirco) {
        circo = `${lieu.departement} — ${lieu.numCirco}ᵉ circonscription`;
      }
    }

    const actorUid =
      typeof a?.uid === "string"
        ? a.uid
        : typeof a?.uid?.["#text"] === "string"
          ? a.uid["#text"]
          : null;
    out.push({
      firstName: ident.prenom ?? "",
      lastName: ident.nom,
      email: extractEmail(a),
      photoUrl: actorUid
        ? `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${actorUid.replace(/^PA/, "")}.jpg`
        : null,
      title: "Député·e",
      institution: "Assemblée nationale",
      party: groupe,
      region: circo,
      level: "NATIONAL",
    });
  }
  return ensureMinimum("Assemblée nationale", out, 400);
}

function extractEmail(a: any): string | null {
  const adresses: any[] = a?.adresses?.adresse ?? [];
  for (const adr of adresses) {
    if (adr?.type === "Mél" && typeof adr?.valeur === "string") {
      const v = adr.valeur.trim();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v;
    }
  }
  return null;
}

// ── Sénat (OpenSAD — ODSEN_GENERAL.csv) ──────────────────────────────────────

const SENAT_CSV = "https://data.senat.fr/data/senateurs/ODSEN_GENERAL.csv";

export async function importSenat(): Promise<ImportedContact[]> {
  const res = await fetchWithTimeout(SENAT_CSV, {}, 120_000);
  if (!res.ok) throw new Error(`Téléchargement Sénat impossible (${res.status})`);
  // CSV encodé en windows-1252
  const text = new TextDecoder("windows-1252").decode(await res.arrayBuffer());

  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("%"));
  if (lines.length < 2) throw new Error("CSV Sénat vide");
  const headers = parseCsvLine(lines[0]!).map((h) => h.trim());
  const idx = (...names: string[]) =>
    headers.findIndex((h) => names.some((n) => h.toLowerCase() === n.toLowerCase()));

  const iNom = idx("Nom usuel");
  const iPrenom = idx("Prénom usuel");
  const iEtat = idx("État");
  const iGroupe = idx("Groupe politique");
  const iCirco = idx("Circonscription");
  const iMail = idx("Courrier électronique");
  const iMatricule = idx("Matricule");

  const out: ImportedContact[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    if (iEtat >= 0 && cols[iEtat]?.trim().toUpperCase() !== "ACTIF") continue;
    const nom = cols[iNom]?.trim();
    const prenom = cols[iPrenom]?.trim();
    if (!nom || !prenom) continue;
    const emailRaw = iMail >= 0 ? cols[iMail]?.trim() : "";
    const email =
      emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;
    const matricule = iMatricule >= 0 ? cols[iMatricule]?.trim() : "";
    out.push({
      firstName: prenom,
      lastName: nom,
      email,
      photoUrl: matricule ? senatorPhotoUrl(nom, prenom, matricule) : null,
      title: "Sénateur·rice",
      institution: "Sénat",
      party: iGroupe >= 0 ? cols[iGroupe]?.trim() || null : null,
      region: iCirco >= 0 ? cols[iCirco]?.trim() || null : null,
      level: "NATIONAL",
    });
  }
  await discardUnavailablePhotos(out);
  return ensureMinimum("Sénat", out, 250);
}

/** Construit l'identifiant public utilisé par le Sénat pour ses portraits. */
function senatorPhotoUrl(lastName: string, firstName: string, matricule: string) {
  const identifier = `${lastName}_${firstName}${matricule}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `https://www.senat.fr/senimg/${identifier}.jpg`;
}

/** Écarte les URLs théoriques quand aucun portrait n'est publié par la source. */
async function discardUnavailablePhotos(contacts: ImportedContact[]) {
  const batchSize = 16;
  for (let index = 0; index < contacts.length; index += batchSize) {
    const batch = contacts.slice(index, index + batchSize);
    const results = await Promise.allSettled(
      batch.map((contact) =>
        contact.photoUrl
          ? fetchWithTimeout(contact.photoUrl, { method: "HEAD" }, 15_000)
          : Promise.resolve(null),
      ),
    );
    results.forEach((result, offset) => {
      if (result.status !== "fulfilled" || !result.value?.ok) {
        batch[offset]!.photoUrl = null;
      }
    });
  }
}

/** Analyse une ligne CSV et ses champs entre guillemets. */
function parseCsvLine(line: string): string[] {
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
    else if (c === ",") {
      cols.push(cur);
      cur = "";
    } else cur += c;
  }
  cols.push(cur);
  return cols;
}

// ── Député·e·s européens (data.europarl.europa.eu API v2) ────────────────────

const EP_BASE = "https://data.europarl.europa.eu/api/v2";
const LD = { Accept: "application/ld+json" };

export async function importParlementEuropeen(
  onProgress?: (done: number, total: number) => void,
): Promise<ImportedContact[]> {
  // Charge d'abord les identifiants de la dixième législature.
  const meps: Array<{
    identifier: string;
    givenName?: string;
    familyName?: string;
    politicalGroup?: string;
  }> = [];
  for (let offset = 0; ; offset += 100) {
    const res = await fetchWithTimeout(
      `${EP_BASE}/meps/show-current?limit=100&offset=${offset}`,
      { headers: LD },
      60_000,
    );
    if (!res.ok) throw new Error(`API Parlement européen indisponible (${res.status})`);
    const json = await res.json();
    const data: any[] = json?.data ?? [];
    meps.push(...data
      .filter((d) => d["api:country-of-representation"] === "FR")
      .map((d) => ({
        identifier: String(d.identifier),
        givenName: d.givenName,
        familyName: d.familyName,
        politicalGroup: d["api:political-group"],
      })));
    if (data.length < 100) break;
  }

  // Charge ensuite les fiches détaillées par petits lots.
  const orgCache = new Map<string, string>();
  const results: ImportedContact[] = [];
  const BATCH = 12;
  let done = 0;

  async function loadOrg(orgId: string): Promise<string> {
    if (orgCache.has(orgId)) return orgCache.get(orgId)!;
    try {
      const res = await fetchWithTimeout(`${EP_BASE}/${orgId}`, { headers: LD }, 30_000);
      if (res.ok) {
        const json = await res.json();
        const label = json?.data?.[0]?.label ?? "";
        orgCache.set(orgId, label);
        return label;
      }
    } catch {}
    orgCache.set(orgId, "");
    return "";
  }

  for (let i = 0; i < meps.length; i += BATCH) {
    const batch = meps.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map((m) =>
        fetchWithTimeout(`${EP_BASE}/meps/${m.identifier}`, { headers: LD }, 30_000).then(
          (r) => (r.ok ? r.json() : null),
        ),
      ),
    );
    for (const s of settled) {
      if (s.status !== "fulfilled" || !s.value?.data?.[0]) continue;
      const p = s.value.data[0];
      // Ne conserve que les membres dont l'URI de citoyenneté se termine par FRA.
      const memberships: any[] = p.hasMembership ?? [];
      let euGroupOrg: string | null = null;
      let nationalGroupOrg: string | null = null;
      for (const mem of memberships) {
        const cls = mem?.membershipClassification ?? "";
        if (mem?.memberDuring?.endDate) continue; // Mandats en cours uniquement.
        const orgId = typeof mem?.organization === "string" ? mem.organization : null;
        if (!orgId) continue;
        if (cls.includes("EU_POLITICAL_GROUP")) euGroupOrg ??= orgId;
        if (cls.includes("NATIONAL_POLITICAL_GROUP")) nationalGroupOrg ??= orgId;
      }
      const party = nationalGroupOrg ? await loadOrg(nationalGroupOrg) : "";
      const group = euGroupOrg ? await loadOrg(euGroupOrg) : "";

      const email = typeof p.hasEmail === "string" ? p.hasEmail.replace("mailto:", "") : null;
      const firstName = p.givenName ?? "";
      const lastName = p.familyName ?? "";
      if (!firstName && !lastName) continue;
      results.push({
        firstName,
        lastName,
        email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
        photoUrl: typeof p.img === "string" && p.img.startsWith("http") ? p.img : null,
        title: "Député·e européen·ne",
        institution: "Parlement européen",
        party: party || group || meps.find((m) => m.identifier === String(p.identifier))?.politicalGroup || null,
        region: "France",
        level: "EU",
      });
    }
    done += batch.length;
    onProgress?.(done, meps.length);
  }
  return ensureMinimum("Parlement européen", results, 50);
}

const RNE_DATASET_API =
  "https://www.data.gouv.fr/api/1/datasets/repertoire-national-des-elus-1/";
const PARIS_API =
  "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/conseillers-de-paris/records";

function normalizedHeader(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function pick(row: Record<string, string>, ...aliases: string[]) {
  const entries = Object.entries(row);
  const wanted = aliases.map(normalizedHeader);
  return entries.find(([key]) => wanted.includes(normalizedHeader(key)))?.[1]?.trim() || null;
}

function localContact(
  row: Record<string, string>,
  level: string,
  institution: string,
  defaultTitle: string,
): ImportedContact | null {
  const firstName = pick(row, "Prénom", "Prénom usuel", "Prénom de l'élu", "prenom");
  const lastName = pick(row, "Nom", "Nom usuel", "Nom de l'élu", "nom");
  if (!firstName && !lastName) return null;
  return {
    firstName: firstName ?? "(?)",
    lastName: lastName ?? "",
    email: pick(row, "Email", "Courriel", "Mail"),
    photoUrl: null,
    title:
      pick(
        row,
        "Fonction",
        "Libellé de la fonction",
        "fonction_dans_l_executif",
        "Mandat",
        "Qualité",
      ) ?? defaultTitle,
    institution,
    party: pick(row, "Nuance", "Groupe politique", "Groupe"),
    region: pick(
      row,
      "Région",
      "Libellé de la région",
      "Département",
      "Libellé du département",
      "Collectivité",
      "Arrondissement",
    ),
    level,
  };
}

function parseDelimited(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const delimiter = lines[0]!.includes(";") ? ";" : ",";
  const parse = (line: string) => {
    const output: string[] = [];
    let value = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i]!;
      if (char === '"' && quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) { output.push(value); value = ""; }
      else value += char;
    }
    output.push(value);
    return output.map((item) => item.trim());
  };
  const headers = parse(lines[0]!);
  return lines.slice(1).map((line) => {
    const values = parse(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

export async function importLocalElectedOfficials(kind: "regions" | "departements"): Promise<ImportedContact[]> {
  const metadataResponse = await fetchWithTimeout(RNE_DATASET_API, {}, 60_000);
  if (!metadataResponse.ok) {
    throw new Error(`Catalogue du Répertoire national des élus indisponible (${metadataResponse.status})`);
  }
  const metadata = (await metadataResponse.json()) as {
    resources?: Array<{ title?: string; url?: string; format?: string }>;
  };
  const marker = kind === "regions" ? "conseillers-regionaux" : "conseillers-departementaux";
  const resource = metadata.resources?.find(
    (entry) =>
      entry.url &&
      entry.format?.toLowerCase() === "csv" &&
      normalizedHeader(entry.title ?? entry.url).includes(normalizedHeader(marker)),
  );
  if (!resource?.url) throw new Error(`Fichier RNE introuvable pour ${kind}`);

  const response = await fetchWithTimeout(resource.url, {}, 180_000);
  if (!response.ok) throw new Error(`Répertoire national des élus indisponible (${response.status})`);
  const rows = parseDelimited(new TextDecoder("utf-8").decode(await response.arrayBuffer()));
  const level = kind === "regions" ? "REGIONAL" : "LOCAL";
  const institution = kind === "regions" ? "Conseil régional" : "Conseil départemental";
  const defaultTitle =
    kind === "regions" ? "Conseiller·ère régional·e" : "Conseiller·ère départemental·e";
  const contacts = rows
    .map((row) => localContact(row, level, institution, defaultTitle))
    .filter((contact): contact is ImportedContact => !!contact);
  return ensureMinimum(
    `Répertoire national des élus (${kind})`,
    contacts,
    kind === "regions" ? 1_000 : 2_500,
  );
}

export async function importParisCouncillors(): Promise<ImportedContact[]> {
  const records: Array<Record<string, unknown>> = [];
  for (let offset = 0; ; offset += 100) {
    const url = new URL(PARIS_API);
    url.searchParams.set("limit", "100");
    url.searchParams.set("offset", String(offset));
    const response = await fetchWithTimeout(url.toString(), {}, 60_000);
    if (!response.ok) throw new Error(`Paris Data indisponible (${response.status})`);
    const page = (await response.json()) as {
      total_count?: number;
      results?: Array<Record<string, unknown>>;
    };
    records.push(...(page.results ?? []));
    if (records.length >= (page.total_count ?? 0) || !(page.results?.length)) break;
  }
  const contacts = records
    .map((raw) => Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, String(value ?? "")])) as Record<string, string>)
    .map((row) => localContact(row, "LOCAL", "Conseil de Paris", "Conseiller·ère de Paris"))
    .filter((contact): contact is ImportedContact => !!contact);
  return ensureMinimum("Paris Data", contacts, 120);
}

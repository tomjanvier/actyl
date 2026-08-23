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
  level: string; // NATIONAL | EU
};

const UA = { "User-Agent": "Actyl/1.0 (open-source advocacy CRM)" };

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

  // Organes: uid -> { codeType, libelle }
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
    let departement: string | null = null;
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
        departement = lieu.departement;
        circo = `${lieu.departement} — ${lieu.numCirco}ᵉ circonscription`;
      }
    }

    out.push({
      firstName: ident.prenom ?? "",
      lastName: ident.nom,
      email: extractEmail(a),
      photoUrl: a?.uid
        ? `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${String(a.uid).replace(/^PA/, "")}.jpg`
        : null,
      title: "Député·e",
      institution: "Assemblée nationale",
      party: groupe,
      region: circo,
      level: "NATIONAL",
    });
  }
  return out;
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

  const iMat = idx("Matricule");
  const iNom = idx("Nom usuel");
  const iPrenom = idx("Prénom usuel");
  const iEtat = idx("État");
  const iGroupe = idx("Groupe politique");
  const iCirco = idx("Circonscription");
  const iMail = idx("Courrier électronique");

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
    out.push({
      firstName: prenom,
      lastName: nom,
      email,
      photoUrl: null,
      title: "Sénateur·rice",
      institution: "Sénat",
      party: iGroupe >= 0 ? cols[iGroupe]?.trim() || null : null,
      region: iCirco >= 0 ? cols[iCirco]?.trim() || null : null,
      level: "NATIONAL",
    });
  }
  return out;
}

/** Minimal CSV line parser supporting quoted fields. */
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
  // 1) All term-10 MEP identifiers
  const meps: Array<{ identifier: string; givenName?: string; familyName?: string }> = [];
  for (let offset = 0; ; offset += 100) {
    const res = await fetchWithTimeout(
      `${EP_BASE}/meps?parliamentary-term=10&limit=100&offset=${offset}`,
      { headers: LD },
      60_000,
    );
    if (!res.ok) throw new Error(`API Parlement européen indisponible (${res.status})`);
    const json = await res.json();
    const data: any[] = json?.data ?? [];
    meps.push(...data.map((d) => ({
      identifier: String(d.identifier),
      givenName: d.givenName,
      familyName: d.familyName,
    })));
    if (data.length < 100) break;
  }

  // 2) Details per MEP (concurrency-limited)
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
      // French members only (citizenship authority URI ends with FRA)
      const citizenship: string = p.citizenship ?? "";
      if (!citizenship.endsWith("/FRA")) continue;

      const memberships: any[] = p.hasMembership ?? [];
      let euGroupOrg: string | null = null;
      let nationalGroupOrg: string | null = null;
      for (const mem of memberships) {
        const cls = mem?.membershipClassification ?? "";
        if (mem?.memberDuring?.endDate) continue; // current only
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
        party: party || group || null,
        region: "France",
        level: "EU",
      });
    }
    done += batch.length;
    onProgress?.(done, meps.length);
  }
  return results;
}

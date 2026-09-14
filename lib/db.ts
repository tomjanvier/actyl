/**
 * Prisma client singleton (Prisma 7, client généré dans `generated/prisma`).
 *
 * Next.js hot-reloads modules in development, which would otherwise create a
 * créerait un nouveau groupe de connexions à chaque rechargement. Le stockage
 * du client dans `globalThis` évite d'épuiser les connexions PostgreSQL.
 *
 * Le client généré est Rust-free : chaque instance EXIGE un adaptateur
 * (`new PrismaClient()` sans adaptateur lève une erreur). Branches :
 * - URL Prisma Postgres (`prisma+postgres://...`, connect string directe
 *   `PRISMA_DIRECT_TCP_URL`) → `PrismaPostgresAdapter` (HTTP/WebSockets,
 *   sans connexion TCP persistante). **Seul mode compatible Cloudflare
 *   Workers.** Utilisé en production et en preview.
 * - URL Neon (`*.neon.tech`, poolée ou directe) → `PrismaNeonHttp` (fetch).
 *   Transition locale et secours Node.
 * - Autre URL PostgreSQL (Docker local, Supabase, RDS) → `PrismaPg`,
 *   réservé au runtime Node local. Non exécuté sur Workers.
 *
 * Variables :
 * - `DATABASE_URL` : URL Prisma Postgres en production/preview (secret
 *   Worker) ; URL Neon directe ou classique en développement local.
 * - CLI (`prisma db push`, seed, scripts) : voir `prisma.config.ts`
 *   (lit `DATABASE_URL` de `.env`, ou `dotenv -e .dev.vars -- ...`).
 *   Jamais de migration destructive sans dump préalable.
 */
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPostgresAdapter } from "@prisma/adapter-ppg";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function isPrismaPostgresUrl(url: string): boolean {
  // URL directe Prisma Postgres, ex. :
  // `postgres://identifier:key@db.prisma.io:5432/postgres?sslmode=require`
  // (console Prisma → Connect). L'adaptateur l'utilise comme identifiant et
  // communique en HTTP/WebSockets, jamais en TCP direct.
  return url.includes("db.prisma.io") || url.includes(".prisma-data.net");
}

function isNeonUrl(url: string): boolean {
  return url.includes("neon.tech");
}

function createClient(): PrismaClient {
  // Sans URL (build, démo sans base), on construit un client factice : les
  // appels réels échouent alors en erreur de connexion explicite.
  const url =
    process.env.DATABASE_URL ?? "postgresql://localhost:5432/actyl_unused";
  if (!process.env.DATABASE_URL) {
    console.warn(
      "[prisma] DATABASE_URL absente : client factice (requêtes en échec, mode démo attendu)."
    );
  }
  const log: Array<"warn" | "error"> =
    process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];

  if (url.startsWith("prisma+postgres://") || url.startsWith("prisma://")) {
    // Prisma Accelerate (retiré le 01/12/2026) : utiliser l'URL directe
    // Prisma Postgres (`postgres://...@db.prisma.io...`). Échec explicite
    // plutôt qu'une erreur de protocole obscure dans l'adaptateur.
    throw new Error(
      "URL Prisma Accelerate détectée : ce service est retiré le 01/12/2026. Utilisez l'URL directe Prisma Postgres (console Prisma → Connect)."
    );
  }

  if (isPrismaPostgresUrl(url)) {
    return new PrismaClient({
      adapter: new PrismaPostgresAdapter({ connectionString: url }),
      log,
    });
  }

  if (isNeonUrl(url)) {
    return new PrismaClient({ adapter: new PrismaNeonHttp(url, {}), log });
  }

  // Runtime Node local uniquement (jamais sur Workers).
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
    log,
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

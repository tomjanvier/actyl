import { defineConfig } from "prisma/config";

// Configuration CLI Prisma 7 : l'URL de la base n'est plus lue dans le schéma.
// - En local : `.env` (chargé automatiquement par la CLI). Utiliser l'URL
//   DIRECTE Neon pendant la transition, puis l'URL Prisma Postgres.
// - Accès via `.dev.vars` uniquement : `dotenv -e .dev.vars -- prisma ...`
//   (`dotenv-cli` est déjà en devDependencies).
// - `process.env` direct (et non `env()`) pour que `prisma generate`
//   fonctionne sans variable définie.
// - Jamais de migration destructive sans dump préalable (voir
//   CLOUDFLARE_DEPLOYMENT.md §6).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/actyl_unused",
  },
});

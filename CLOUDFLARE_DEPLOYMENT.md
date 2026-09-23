# Actyl — Déploiement Cloudflare Workers

Application Next.js 15 déployée sur Cloudflare Workers via `@opennextjs/cloudflare`.
Base **Prisma Postgres** (décision validée le 2026-09-14, voir §6). Prisma 7
Rust-free + adaptateur HTTP : aucune réécriture fonctionnelle, même schéma.

Worker : **`actyl-cloudflare`** · preview : **`actyl-cloudflare-preview`**.

## 1. Architecture cible

- **Workers** (OpenNext) : toute l'application (pages, API `/api/*`, `/api/v1/*`, Server Actions, middleware `jose`).
- **Prisma Postgres** : base cible. Client Prisma 7 (`prisma-client`, `output`
  `./generated/prisma`, voir `prisma/schema.prisma` + `prisma.config.ts`) avec
  `@prisma/adapter-ppg` (HTTP/WebSockets, sans connexion TCP persistante).
  `lib/db.ts` choisit l'adaptateur selon l'URL : Prisma Postgres (prod/preview),
  Neon HTTP (transition locale), `pg` (Docker local, Node uniquement).
- **Patch WASM** : `scripts/patch-opennext-prisma-wasm.mjs`, exécuté par
  `pnpm build:cf` après OpenNext. Le compilateur de requêtes Prisma est
  empaqueté en module WASM statique (le `new WebAssembly.Module()` runtime est
  interdit par workerd). Voir §8 et l'en-tête du script. **Plan Workers Paid
  requis** (bundle ~4,6 Mo gzip > plafond 3 Mo du plan gratuit).
- **Resend** : emails (inchangé, `fetch` natif compatible).
- **Turnstile** : captcha (inchangé).
- **DNS / SSL / WAF / DDoS** : Cloudflare (zone du domaine).
- **R2 / KV / D1 / Durable Objects / Queues : non utilisés** (aucun stockage de fichiers :
  les imports CSV sont parsés côté client ; le rate limiting reste en mémoire, voir §8).

## 2. Variables d'environnement

| Variable | Portée | Où la définir |
|---|---|---|
| `DATABASE_URL` (URL **directe** Prisma Postgres, `postgres://...@db.prisma.io...`) | privée, serveur | `wrangler secret put DATABASE_URL` + `.dev.vars` local |
| `DATABASE_URL` locale (transition) : URL **directe** Neon | privée, dev/CLI | `.env` local (jamais dans le Worker) — voir §6 |
| `AUTH_SECRET` (32+ car.) | privée | secret |
| `CRON_SECRET` | privée | secret |
| `TURNSTILE_SECRET_KEY` | privée | secret |
| `RESEND_API_KEY` | privée (vide = simulation tracée en base) | secret |
| `EMAIL_FROM` | privée | secret (ou `vars` si non sensible — ici en secret) |
| `ACT_SSO_ISSUER` (ex. `https://act.plaidact.org`) | non sensible, serveur | secret (ou `vars`) — bouton masqué si absent |
| `ACT_SSO_CLIENT_ID` | non sensible, serveur | secret (ou `vars`) — bouton masqué si absent |
| `ACT_SSO_CLIENT_SECRET` (vide = client public PKCE) | privée, serveur | secret |
| `SEED_ADMIN_*`, `ACTYL_SUPER_ADMIN_EMAIL` | setup local uniquement | `.env` local |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | **publique** | `wrangler.jsonc` → `vars` |
| `NEXT_PUBLIC_APP_URL` | **publique** (base de la `redirect_uri` SSO) | `wrangler.jsonc` → `vars` (prod : `https://actyl.org` ; preview : origine `*.workers.dev` enregistrée côté Act) |
| `LANDING_DEMO_LIST_ID` | **publique** | `wrangler.jsonc` → `vars` |

Ne jamais committer de vraie clé. Les `.env*` et `.dev.vars` sont gitignorés.

## 3. Commandes

```bash
# Installation
pnpm install

# Développement classique (Node)
pnpm dev

# Contrôles
pnpm lint && pnpm typecheck

# Build Cloudflare (Prisma generate + adaptation OpenNext + patch WASM Prisma)
pnpm build:cf

# CLI Prisma via .dev.vars (sans toucher .env) : dotenv-cli est installé
dotenv -e .dev.vars -- pnpm exec prisma db push

# Preview locale du Worker (nécessite .dev.vars)
cp .dev.vars.example .dev.vars   # une seule fois, puis renseigner
pnpm preview                      # -> http://localhost:8787

# Types des bindings Cloudflare
pnpm cf:typegen
```

## 4. Premier déploiement (preview, sans risque)

```bash
# 1. Secrets du Worker de preview
wrangler secret put DATABASE_URL --env preview
wrangler secret put AUTH_SECRET --env preview
wrangler secret put CRON_SECRET --env preview
wrangler secret put TURNSTILE_SECRET_KEY --env preview
wrangler secret put RESEND_API_KEY --env preview   # optionnel (vide = simulé)
wrangler secret put EMAIL_FROM --env preview

# 2. Build + déploiement preview (demande confirmation, ne touche pas la prod)
pnpm build:cf
wrangler deploy --env preview
# ou : pnpm deploy -- --env preview
```

## 5. Mise en production (avec confirmation explicite préalable)

```bash
wrangler secret put DATABASE_URL --env production
wrangler secret put AUTH_SECRET --env production
wrangler secret put CRON_SECRET --env production
wrangler secret put TURNSTILE_SECRET_KEY --env production
wrangler secret put RESEND_API_KEY --env production
wrangler secret put EMAIL_FROM --env production

pnpm build:cf
wrangler deploy --env production
```

Associer ensuite le domaine (route) au Worker dans le dashboard Cloudflare
(Workers → `actyl-cloudflare` → Settings → Domains & Routes), ou via
`wrangler.jsonc` (`routes`, volontairement absent par défaut).

## 6. Base Prisma Postgres — migration depuis Neon (avec validations)

Contexte : Prisma ne peut pas compiler ses requêtes dans un Worker via Neon
direct (WASM non empaquetable par OpenNext — bug upstream
`opennextjs/opennextjs-cloudflare#139` ; Prisma Accelerate, l'alternative
officielle, est **retiré le 01/12/2026**). Le chemin pérenne officiel est
**Prisma Postgres** (adaptateur `@prisma/adapter-ppg`, prouvé fonctionnel en
Worker local le 2026-09-14 : compilation WASM statique + requête HTTP
jusqu'au refus d'authentification attendu avec une fausse clé).

⚠️ **Aucune étape ci-dessous ne s'exécute sans confirmation explicite.**
Rien n'a été migré : la base Neon actuelle est intacte.

1. Provisionner Prisma Postgres (console Prisma → nouveau projet, région UE :
   ex. Francfort). Récupérer l'URL **directe** (`postgres://...@db.prisma.io...`,
   champ `PRISMA_DIRECT_TCP_URL` des détails de connexion).
2. Sauvegarder Neon : `pg_dump` complet archivé + restauration testée sur une
   base jetable.
3. Appliquer le schéma sur la base Prisma Postgres vide :
   `DATABASE_URL=<directe> pnpm exec prisma db push` (relire la sortie ;
   jamais en aveugle). Alternative `prisma migrate` : relire le diff SQL.
4. Migrer les données : `pg_dump` (Neon, format custom) puis `pg_restore`
   vers Prisma Postgres **sur une branche/environnement de test d'abord**,
   vérifier les comptages par table, puis seulement la cible finale.
5. Seed si base neuve : `pnpm db:seed` (demande `SEED_ADMIN_PASSWORD`).
6. Poser le secret Worker : `wrangler secret put DATABASE_URL --env preview`
   (URL directe Prisma Postgres), redéployer la preview, exécuter la recette
   §12 contre des données de test.
7. **Sauvegardes** : backups automatiques Prisma Postgres + `pg_dump`
   hebdomadaire externe ; documenter la procédure de restauration.
8. Transition locale : `.env` peut garder l'URL Neon **directe** (branche
   `PrismaNeonHttp` de `lib/db.ts`) jusqu'à la bascule complète.

La CLI lit sa config dans `prisma.config.ts` (URL via `process.env`,
donc `prisma generate` fonctionne sans variable définie).

## 7. Cron `/api/cron/reference-packs`

- Déclencheur configuré dans `wrangler.jsonc` (`0 4 * * 1`, comme `vercel.json`).
- **Limite connue (bloquante pour la prod)** : le traitement actuel télécharge et
  décompresse plusieurs jeux open-data avec des timeouts de 60–180 s
  (`lib/importers/officials.ts`, `fflate`, `maxDuration: 300` ignoré sur Workers).
  Avant la production : découper en lots < 30 s (batches + `Queues` en suivi) ou
  externaliser sur un job hors Worker. En preview, vérifier les logs
  (`wrangler tail`) et s'attendre à des timeouts sur les gros imports.
- `CRON_SECRET` obligatoire (header `Authorization: Bearer ...`), même en preview.

## 8. Limites de consommation (anti-facture-surprise)

- **Plan Workers Paid obligatoire** : le bundle (Next + compilateur Prisma
  WASM ~3,4 Mo) dépasse le plafond de 3 Mo du plan gratuit (~4,6 Mo gzip).
- `wrangler.jsonc` : bloc `limits` documenté (ex. `"limits": { "cpu_ms": 50 }`).
- Observabilité Workers activée (`observability.enabled`) + alertes de facturation
  dans le dashboard Cloudflare (Notifications → Billing).
- Prisma Postgres : surveiller les opérations (quota du plan) ; le driver HTTP
  n'ouvre pas de connexions persistantes.
- **Patch WASM** (`scripts/patch-opennext-prisma-wasm.mjs`) : échoue bruyamment
  si l'ancre du chargeur change (montée de version Prisma/OpenNext) → revalider
  par `pnpm build:cf` + `wrangler dev` + route DB avant tout déploiement.
  Ne jamais déployer un bundle dont le patch a été contourné.
- Points de vigilance CPU : `bcryptjs` (coût 11, ~100 ms) sur inscription/connexion
  et `fflate` sur les imports — envisager un coût réduit ou un fournisseur
  d'auth externe si les limites CPU sont atteintes.
- Points de vigilance CPU : `bcryptjs` (coût 11, ~100 ms) sur inscription/connexion
  et `fflate` sur les imports — envisager un coût réduit ou un fournisseur
  d'auth externe si les limites CPU sont atteintes.
- Rate limiting : `lib/rate-limit.ts` reste **en mémoire** (incohérent entre
  isolats). Suffisant en démarrage ; passer à Workers KV ou au Rate Limiting
  Cloudflare avant montée en charge (interface à conserver).

## 9. Logs, CORS, headers

- Logs : `wrangler tail actyl-cloudflare --env production` (temps réel),
  dashboard Workers → Observability.
- CORS public `/api/v1/*` : inchangé (`lib/api.ts`, réponses `OPTIONS`).
- Headers de sécurité : inchangés (`next.config.ts` + `middleware.ts`, CSP
  `frame-ancestors *` limitée à `/embed/*`).

## 10. Rollback

- Chaque `wrangler deploy` versionne le Worker : Workers → `actyl-cloudflare` →
  Deployments → **Rollback** vers la version N-1 (immédiat, sans rebuild).
- Base : restaurer via backup Prisma Postgres ou `pg_restore` du dump
  pré-déploiement (Neon d'origine conservée intacte pendant la transition),
  puis redéployer le Worker correspondant (le schéma est poussé explicitement,
  jamais automatiquement au déploiement).
- Garder `vercel.json` tant que le domaine pointe encore vers Vercel pendant la
  transition DNS (bascule par changement de route, réversible en 2 minutes).

## 11. Checklist de mise en production

- [ ] Dump `pg_dump` de Neon archivé + restauration testée sur base jetable.
- [ ] Projet Prisma Postgres créé (région UE), URL directe récupérée.
- [ ] `prisma db push` + migration des données + `pnpm db:seed` exécutés et
  vérifiés (comptages par table) — avec confirmation explicite.
- [ ] Tous les secrets posés (`--env production`), aucune clé dans Git (`git status` propre).
- [ ] `pnpm lint && pnpm typecheck && pnpm build:cf` verts (patch WASM appliqué :
  `[prisma-wasm] ... patché (N chargeur(s))` dans la sortie).
- [ ] Preview `actyl-cloudflare-preview` validée (recette §12, y compris `/api/v1/*` et `/p/{slug}`).
- [ ] Domaine/route associé, WAF et règles Turnstile vérifiés.
- [ ] Alertes billing Cloudflare activées, `wrangler tail` surveillé 24 h.
- [ ] Plan de découpage du cron validé (ou cron désactivé en prod en attendant).

## 12. Recette obligatoire (preview)

Authentification : inscription, connexion, session JWT httpOnly, `bcrypt`,
middleware (routes protégées → `/sign-in` sans cookie). Métier : contacts,
campagnes, kanban, supporters, pétitions, RSVP, tâches, imports open-data
(mesurés, voir §7), exports CSV/JSON. API publique `/api/v1/*` (ping, supporters,
donations, signatures + CORS `OPTIONS`). Intégration WordPress (Bearer).
Resend (ou simulation tracée), Turnstile, rate limiting (429 attendu),
pages `/p/{slug}` et embeds (`frame-ancestors`, `noindex`). Variables privées
absentes des réponses et du JS client (inspecter le bundle).

```bash
# Exemples
curl -s https://<preview>/api/v1/ping
curl -s -X OPTIONS https://<preview>/api/v1/supporters -i | head -20
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<preview>/api/cron/reference-packs
```

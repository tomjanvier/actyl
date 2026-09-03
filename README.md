# Actyl — by [PLAID·ACT](https://plaidact.org)

CRM de plaidoyer open-source pour associations et ONG : campagnes de lobbying,
suivi des décideurs et mobilisation citoyenne.

## Fonctionnalités

- **Annuaire des décideurs** : députés, sénateurs, eurodéputés importés depuis
  les sources officielles (photos incluses), champs personnalisés par
  organisation, thématiques d'intérêt, notes d'équipe + notes privées
  personnelles, filtres avancés, export CSV/JSON.
- **Import officiel** (admin → Paramètres → Importer) :
  - Assemblée nationale ([open data AMO10](https://data.assemblee-nationale.fr))
  - Sénat ([OpenSAD / ODSEN_GENERAL.csv](https://data.senat.fr/les-senateurs/))
  - Parlement européen ([API v2 data.europarl.europa.eu](https://data.europarl.europa.eu))
  - Ou en CLI : `pnpm tsx scripts/import-officials.ts [an|senat|pe|all]`
- **Campagnes & kanban** : pipeline glisser-déposer (dnd-kit) avec historique
  horodaté des mouvements.
- **Interpellation citoyenne** : modèles d'emails à variables, envois internes
  ou page publique `/p/{slug}` (Resend ou mode simulé sans clé API).
  Ciblage territorial à la [Action Button](https://www.actionbutton.org) :
  le citoyen renseigne sa région et son message est prioritairement transmis
  aux décideurs de son territoire (insensible aux accents/casse, avec repli
  sur toutes les cibles). Parcours d'engagement en escalier :
  signature → email → partage.
- **Mobilisation** : pétitions publiques avec objectif et progression,
  événements avec RSVP, tâches et relances assignables.
- **Base de soutiens** : chaque signature, interpellation ou RSVP alimente
  une base personnes unifiée (dédupliquée par email) avec compteur
  d'interactions, tags de segmentation façon NationBuilder, filtres par
  origine/tag et export CSV.
- **Embeds** : intégrez une liste publiée dans votre site WordPress :
  `<iframe src="https://votre-domaine/embed/list/{id}" width="100%" height="480" style="border:0" loading="lazy"></iframe>`
- **Sécurité** : sessions JWT httpOnly vérifiées en edge middleware,
  rate-limiting de tous les endpoints publics (connexions, inscriptions,
  signatures, RSVP, envois), échappement HTML des emails, anti open-redirect.
- **API publique d'ingestion** (`/api/v1/*`) pour connecter votre site
  WordPress (extension [campagneplaidact](https://github.com/tomjanvier/campagneplaidact))
  : newsletter, signatures de pétition (Petitioner) et dons (Givoly).
  Tokens Bearer créés dans Paramètres → API & intégrations ; seul un hash
  SHA-256 est stocké, révocable à tout moment :
  - `POST /api/v1/supporters` — `{email, fullName?, city?, source?, tags?[]}`
  - `POST /api/v1/petitions/{slug}/signatures` — `{name, email, city?}`
  - `POST /api/v1/donations` — `{email, amount|amountCents, provider?, …}`
  - `GET /api/v1/ping` — vérification du token
- **Annuaire étendu (optionnel)** : activez les segments adhérent·e·s,
  bénévoles, donateur·ice·s et soutiens dans Paramètres → API & intégrations ;
  le menu latéral filtre alors le répertoire par catégorie.
- **Équipes de campagne** (élections) : importez l'équipe d'un·e candidat·e
  en un copier-coller depuis Contacts → « Équipe de campagne ».
- **Attributs dédiés** : chaque liste partagée peut définir ses propres
  colonnes (champs personnalisés scopés à la liste).
- **Rôles** : Admin · Responsable campagne · Militant·e · Observateur·rice.
- **Inscriptions modérées (optionnel)** : mode « Sur demande » — les visiteurs
  soumettent une demande (association, site, téléphone) que les admins
  approuvent. Bascule dans Paramètres → Membres & accès, ou via la variable
  d'environnement `SIGNUP_MODE=APPROVAL`.
- **Thème clair & sombre**, interface entièrement en français.

## Démarrage

```bash
pnpm install
SEED_ADMIN_PASSWORD='un-mot-de-passe-fort' pnpm setup
pnpm dev          # http://localhost:3000
```

Le peuplement initial crée uniquement le super-administrateur
`admin@actyl.org`. L’adresse peut être remplacée avec `SEED_ADMIN_EMAIL`.

## Production

Le déploiement de référence tourne sur Vercel avec une base Postgres Neon.

1. `DATABASE_URL` (Postgres) — provisionné via l'intégration Marketplace
   (`vercel integration add neon`), `prisma db push` pour appliquer le schéma
2. Variables d'environnement (voir `.env.example`) : `AUTH_SECRET` (32+
   caractères), `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   et `TURNSTILE_SECRET_KEY`, optionnellement `SIGNUP_MODE=APPROVAL`.
   La clé publique peut être exposée au navigateur ; le secret reste uniquement
   dans Vercel, configuré pour Preview et Production. La vérification serveur
   protège les inscriptions, signatures et interpellations citoyennes.
3. `pnpm build && pnpm start` — compatible Vercel, Docker, VPS Node.

## Stack

Next.js 15 (App Router, Server Actions) · TypeScript strict · Prisma ·
Tailwind CSS v4 · Radix UI · dnd-kit · Resend · jose/bcryptjs.

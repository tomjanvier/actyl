# Déploiement Vercel et Neon

## Variables requises

- `DATABASE_URL` : chaîne PostgreSQL Neon avec SSL ;
- `AUTH_SECRET` : secret aléatoire d’au moins 32 caractères ;
- `CRON_SECRET` : secret distinct utilisé par la synchronisation hebdomadaire ;
- `LANDING_DEMO_LIST_ID` : identifiant facultatif d’une liste publiée à afficher
  sur la page d’accueil ;
- `RESEND_API_KEY` et `EMAIL_FROM` : facultatifs tant que les emails restent en
  mode simulé.

Les clés EmailOctopus sont enregistrées depuis les paramètres de chaque espace
et ne doivent pas être ajoutées aux variables globales du projet.

## Mise à jour du schéma

Ce dépôt utilise actuellement `prisma db push` et ne possède pas d’historique de
migrations Prisma initial. Avant de déployer cette version, appliquer le schéma
sur une branche de base de données de préproduction :

```bash
pnpm prisma generate
pnpm prisma db push
pnpm typecheck
pnpm build
```

Vérifier ensuite les tables `list_change_proposals` et
`shared_campaign_refs`, la colonne `campaigns.pinned`, puis la contrainte unique
`supporters(workspaceId, email)`. Les éventuelles lignes historiques de soutiens
sans `workspaceId` doivent être attribuées à leur espace avant le `db push`.

## Tâche hebdomadaire

`vercel.json` appelle `/api/cron/reference-packs` chaque lundi à 04:00 UTC.
Vercel transmet automatiquement `Authorization: Bearer $CRON_SECRET`. Une
réponse HTTP 207 indique qu’une ou plusieurs sources publiques ont échoué sans
annuler les propositions déjà créées pour les autres packs.

La route demande une durée maximale de 300 secondes. Le forfait Vercel retenu
doit autoriser cette durée ; contrôler les journaux de la fonction après le
premier passage en production, les crons ne s’exécutant pas sur les previews.

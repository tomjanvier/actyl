# Déploiement Vercel et Neon

## Variables requises

- `DATABASE_URL` : chaîne PostgreSQL Neon avec SSL ;
- `AUTH_SECRET` : secret aléatoire d’au moins 32 caractères ;
- `CRON_SECRET` : secret distinct utilisé par la synchronisation hebdomadaire ;
- `LANDING_DEMO_LIST_ID` : identifiant facultatif d’une liste publiée à afficher
  sur la page d’accueil ;
- `RESEND_API_KEY` et `EMAIL_FROM` : facultatifs tant que les emails restent en
  mode simulé.

Le suivi des ouvertures est activé uniquement pour les envois réels lorsque
`NEXT_PUBLIC_APP_URL` est configurée. Le pixel est signé avec `AUTH_SECRET`;
sans origine publique configurée, l'email part sans suivi. Les emails suivis
signalent cette mesure à leurs destinataires, et les statistiques restent
indicatives selon le client de messagerie.

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
`shared_campaign_refs`, les colonnes `campaigns.pinned` et
`campaigns.isPublished`, puis la contrainte unique
`supporters(workspaceId, email)` et la contrainte unique
`donations(workspaceId, idempotencyKey)`. Les éventuelles lignes historiques de soutiens
sans `workspaceId` doivent être attribuées à leur espace avant le `db push`.
`campaigns.isPublished` est ajouté avec la valeur `false` : les pages publiques
existantes restent privées jusqu'à leur publication explicite depuis l'en-tête
de la campagne.

## Espaces associatifs et pages publiques

Chaque URL publique d'association est basée sur le slug unique de son espace :
`/association/{slug-association}` affiche uniquement ses campagnes publiées et
ses événements futurs publiés. Une campagne est accessible à
`/association/{slug-association}/{slug-campagne}` ; son formulaire d'action et
sa pétition résolvent les données dans ce même espace. Les anciennes pages
`/p/{slug-campagne}` restent disponibles uniquement lorsqu'un seul espace a
publié ce slug, sinon elles répondent 404 pour éviter toute ambiguïté.

## Tâche hebdomadaire

`vercel.json` appelle `/api/cron/reference-packs` chaque lundi à 04:00 UTC.
Vercel transmet automatiquement `Authorization: Bearer $CRON_SECRET`. Une
réponse HTTP 207 indique qu’une ou plusieurs sources publiques ont échoué sans
annuler les propositions déjà créées pour les autres packs.

La route demande une durée maximale de 300 secondes. Le forfait Vercel retenu
doit autoriser cette durée ; contrôler les journaux de la fonction après le
premier passage en production, les crons ne s’exécutant pas sur les previews.

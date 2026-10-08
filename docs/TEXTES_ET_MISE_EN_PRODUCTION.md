# Modifier les textes d’Actyl et préparer la production

## Textes de la landing page

Les textes principaux de la page d’accueil sont déjà modifiables sans changer le code :

1. Connectez-vous avec le compte super-administrateur.
2. Ouvrez **Super administration → Page d’accueil** (`/admin`).
3. Modifiez le titre, l’introduction et le bouton, les titres et descriptions des six blocs, la présentation de l’annuaire public, puis le pied de page.
4. Enregistrez. Les changements s’appliquent à la page `/`.

Cette configuration est globale à toute l’instance Actyl. L’ordre est : introduction → six blocs de présentation → annuaire public → pied de page. Les icônes, les libellés de connexion et d’inscription, ainsi que le crédit technique restent dans le code. Les paramètres historiques permettent aussi d’ouvrir le même formulaire depuis Paramètres → Espaces.

## Textes de l’outil

Les libellés visibles dans l’application (navigation, boutons, formulaires, messages, aides et états vides) sont actuellement écrits directement dans les composants et pages. Il n’existe pas encore d’éditeur central dans l’outil pour les changer.

Pour les retrouver par zone, partez de ces fichiers :

- Navigation et identité : `components/layout/sidebar.tsx`, `components/layout/page-header.tsx`.
- Campagnes et leurs onglets : `app/(dashboard)/campaigns/`, `components/campaigns/`, `components/kanban/`.
- Contacts : `app/(dashboard)/contacts/page.tsx`, `components/contacts/`.
- Membres, équipes et paramètres : `app/(dashboard)/settings/`, `components/settings/`.
- Événements, listes, soutiens et tâches : `app/(dashboard)/events/`, `components/events/`, `components/lists/`, `components/supporters/`, `components/tasks/`.
- Pages publiques, pétitions et formulaires : `app/association/`, `app/p/`, `app/e/`, `components/public/`.
- Connexion et inscription : `app/(auth)/`.

Les statuts, rôles et options partagés sont souvent centralisés dans `lib/constants.ts`. Pour l’instant, les textes métier personnalisés (par exemple nom d’espace, campagne ou champ) se règlent dans les données de l’espace, pas dans un catalogue global.

## État de préparation à la production

Le dépôt cible Cloudflare Workers (`actyl-cloudflare`) via OpenNext et Prisma Postgres. Le guide opérationnel complet est `CLOUDFLARE_DEPLOYMENT.md`. Le code et sa configuration ne suffisent pas à attester que la production est prête : il faut notamment vérifier la base réellement ciblée, les secrets du Worker et le parcours de l’application sur la preview.

Points bloquants ou à confirmer avant un lancement :

- Le guide de déploiement indique que la migration de Neon vers Prisma Postgres n’a pas été effectuée ; sauvegarde restaurable, migration des données et vérification des volumes sont requises si cette migration reste le chemin retenu.
- La recette complète sur le Worker de preview reste nécessaire, y compris connexion, parcours métier et API publique.
- Le cron hebdomadaire d’import de référentiels est signalé comme susceptible de dépasser les limites Workers ; le découper, l’externaliser ou le désactiver avant production.
- Vérifier les secrets de production, la configuration Turnstile, Resend, l’URL publique/SSO, le domaine, le plan Workers, les alertes de facturation et la procédure de rollback.
- Exécuter les contrôles documentés (`pnpm lint`, `pnpm typecheck`, `pnpm build:cf`) et inspecter les résultats avant tout déploiement.

La commande de déploiement production modifie un service public. Ce guide ne l’exécute pas. Une fois les prérequis ci-dessus vérifiés et la preview validée, la procédure détaillée se trouve dans `CLOUDFLARE_DEPLOYMENT.md`.

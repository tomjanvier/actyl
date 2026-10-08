# Super administration, annuaire et référentiels — 7 octobre 2026

La page `/admin` centralise les espaces, leurs membres, les demandes d’accès,
le mode d’inscription et les réglages de la page publique. Elle exige le rôle
super administrateur côté serveur. Les sauvegardes administratives utilisent
une transaction Neon sur WebSocket ; les lectures habituelles restent en HTTP.
Les décisions sur les demandes d’accès vérifient leur état pour éviter une
approbation ou un refus concurrent. Les contributions facultatives des demandes
sont lues par JSON de ligne, compatible avec les anciennes tables où ces colonnes
sont absentes et avec les nouvelles tables où elles sont renseignées.

L’annuaire interactif est placé immédiatement sous la présentation de la landing.
Son chargement et son état vide sont explicites. Les liens et boutons ne sont
plus imbriqués. Les surfaces du mode sombre sont opaques, avec une hiérarchie
neutre et un contraste lisible. Les petites animations respectent la préférence
de réduction des mouvements.

## Commissions et imports

Les commissions AN étaient extraites puis perdues dans le mapping de l’import.
La colonne du Sénat et les appartenances aux commissions du Parlement européen
n’étaient pas récupérées. La synchronisation ne comparait pas ces valeurs.
Le pipeline conserve désormais les commissions dans un champ `MULTI_SELECT`,
les expose dans les listes partagées et publiques et les compare lors des mises
à jour soumises à validation. Les imports complètent les valeurs vides et
préservent les saisies existantes des équipes. Le filtre de l’annuaire porte sur
l’ensemble des contacts, avec pagination côté serveur.

Le rapprochement des anciennes fiches exige une identité compatible et unique.
Une adresse partagée entre plusieurs personnes ne suffit pas. Les écritures
techniques sont exécutées par lots de huit ; les nouvelles valeurs de commissions
sont insérées en lot.

Sources officielles :

- [Assemblée nationale](https://data.assemblee-nationale.fr/static/openData/repository/17/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip)
- [Sénat](https://data.senat.fr/data/senateurs/ODSEN_GENERAL.csv)
- [Parlement européen](https://data.europarl.europa.eu/en/developer-corner/opendata-api)

## Opérations Néon déjà appliquées

Ces opérations sont distinctes de la fusion et du déploiement de cette PR.
La cible et les relations ont été auditées avant les écritures. Les sauvegardes
contenant les contacts restent dans une archive privée hors du dépôt Git.

- `admin@actyl.org` : rôle `isSuperAdmin` restauré sur le compte existant.
- Plaidoyer collectif : 593 copies sûres fusionnées vers les fiches des listes
  partagées ; 1 749 → 1 156 contacts. Les relations compatibles ont été transférées.
- 1 049 éléments de listes et 1 038 appartenances aux référentiels conservés.
- Commissions complétées pour 927 fiches identifiées : 567 AN, 280 Sénat et 80 PE.
  Le champ contient 934 valeurs, y compris les anciennes saisies conservées.
- Contrôle final : aucune relation orpheline dans les douze tables liées contrôlées.

14 copies présentant des divergences de parti ou de fonction sont conservées.
70 personnes des sources actuelles n’ont pas de rapprochement sûr avec les
fiches existantes (2 AN, 68 Sénat). Aucun renouvellement complet des listes,
ajout ou retrait automatique de ces personnes n’a été effectué.

## Vérification

- Lint sans avertissement, TypeScript et `git diff --check`.
- Tests des rapprochements, commissions et rollback transactionnel sur Neon.
- Tests existants des permissions de campagne et des garde-fous du cache public.
- Réimport de cinq fiches officielles existantes : aucun contact ni lien créé.
- Aperçu authentifié, bureau et largeur 390 px : landing, listes, filtre des
  commissions, super administration, mode sombre et absence de débordement horizontal.
- Filtre « Commission des affaires sociales » : 72 contacts sur 72.
- Sauvegarde des réglages publics et entrée dans l’espace depuis `/admin` réussies.
- Build OpenNext/Cloudflare et packaging Wrangler en dry-run.
- Worker local compilé : accès authentifié à `/admin`, filtre des commissions
  et sauvegarde transactionnelle des réglages publics réussis.

Aucune demande d’accès n’était en attente : le flux d’approbation complet n’a
pas été exercé avec un compte réel. Aucune migration de schéma ni publication
en production n’a été effectuée dans cette livraison.

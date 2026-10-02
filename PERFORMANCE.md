# Optimisation Actyl — octobre 2026

## Changements

- Landing : dix contacts transmis au navigateur, pagination et recherche serveur ; chargement progressif de l’annuaire après le contenu principal.
- Intégrations publiques : cinquante contacts par page. Export complet disponible à la demande.
- Listes privées : contacts disponibles demandés à l’ouverture du dialogue, cinquante par page ; suppression du chargement initial de tous les contacts et de toutes les appartenances.
- Session : une lecture des appartenances et du profil par requête, partagée avec le layout. Réglages d’espace dédupliqués dans la requête ; aucune mise en cache persistante des sessions.
- Compteurs du menu chargés en parallèle avec les autres requêtes.
- Compatibilité des anciens réglages : lecture sans migration ni écriture pendant le rendu.

## Cache Cloudflare

`open-next.config.ts` active le cache de données Next.js dans R2, la queue de revalidation et le cache des tags dans des Durable Objects SQLite. `wrangler.jsonc` définit les bindings, les migrations et Smart Placement. Les buckets `actyl-next-cache` et `actyl-next-cache-preview` sont provisionnés séparément.

Les données publiques et les textes de la landing ont une durée de cache de 60 secondes. Les actions de modification invalident les tags. Les recherches libres ne créent pas de nouvelles entrées de cache persistantes. La publication d’une liste est contrôlée dans la base avant chaque réponse : les réponses JSON, CSV et les pages intégrées ne sont pas mises en cache publiquement. Les réponses privées gardent `private, no-store`.

`public/_headers` applique `public, max-age=31536000, immutable` aux fichiers versionnés sous `/_next/static/`. Les pages HTML et les réponses RSC ne sont pas couvertes par cette règle.

Le prochain déploiement doit utiliser ces bindings et migrations. Les buckets seuls ne rendent pas le cache actif sur le Worker actuellement déployé. Aucun réglage « cache everything » n’est nécessaire.

## Mesures et vérification

Production avant modification : HTML de la landing 282 609 octets ; premier octet entre 847 et 3 257 ms sur trois requêtes. Fichiers statiques déjà servis par le CDN, mais avec `max-age=0, must-revalidate` pour le navigateur.

Version compilée locale, avec les mêmes données publiques : HTML environ 55 190 octets, soit 80 % de moins. Ces temps locaux ne sont pas comparables aux temps du Worker distant ; aucune mesure Lighthouse ou de Core Web Vitals n’a été effectuée.

Contrôles reproductibles, sans écriture en base :

```sh
node scripts/check-cache-guards.mjs
node scripts/check-public-directory.mjs http://localhost:3099
pnpm lint --max-warnings=0
pnpm typecheck
pnpm exec prisma validate
pnpm build:cf
pnpm exec wrangler deploy --dry-run --env production
```

Le script contrôle la pagination, les résultats de recherche, l’absence de données privées dans la projection publique, les paramètres invalides, l’export complet, les listes inexistantes et le refus des visiteurs anonymes sur les routes privées. Pour les listes dépubliées, vérifier aussi leur URL publique réelle : elle doit renvoyer 404 même après avoir été chargée précédemment.

Après fusion et déploiement, refaire les mesures sur `https://actyl.org`, vérifier les en-têtes des assets et tester une session réelle. Les écrans connectés n’ont pas été mesurés avec une session utilisateur pendant cette intervention.

La page d’inscription reste dynamique : son mode (ouvert, modéré, fermé) est lu à la visite et ne peut plus être figé pendant un build sans accès à la base.

Worker Cloudflare local final (R2 et Durable Objects simulés, données publiques réelles) : 54 654 octets de HTML ; les contrôles publics et les gardes passent. Les assets versionnés répondent avec `public, max-age=31536000, immutable`. Une vraie liste privée renvoie 404. Dans le navigateur, la page 2 affiche les contacts 11 à 20 et la recherche « Gabriel Attal » affiche le résultat attendu. La simulation de révocation après un accès au cache vérifie le refus des données et du CSV.

## Correction de l’attente initiale après le premier déploiement

La PR #37 est fusionnée (880fe62) et la version Cloudflare du 2 octobre à 12:47 UTC dispose bien des bindings de cache et de Smart Placement. Les mesures distantes montrent malgré cela 559–1 488 ms avant les en-têtes, puis 1 101–2 185 ms pour recevoir toute la landing. La réduction du HTML ne constituait donc pas une mesure du gain de vitesse réel.

Le rendu de la page attendait `getLandingSettings()` avant de produire sa navigation ou ses sections. Le nouveau rendu démarre cette lecture une seule fois, partage sa promesse entre le hero et le footer, et les place dans des frontières Suspense distinctes. La navigation et les autres sections peuvent être envoyées pendant les lectures, et l’annuaire commence indépendamment des réglages.

Le cache régional OpenNext conserve les données R2 localement pendant une minute, avec `bypassTagCacheOnCacheHit: false` : les vérifications des tags restent actives. Les requêtes de total, de facettes et de lignes d’une page sont désormais parallèles ; une page demandée au-delà du dernier résultat est corrigée avec une lecture supplémentaire.

Validation locale : build Cloudflare, déploiement à blanc, lint et types passent, ainsi que les gardes et le script public. Avec une réponse sans compression, la navigation arrive dans le premier morceau HTML, tandis que les données continuent de charger. La compression du runtime local peut regrouper les morceaux : ces temps locaux ne prouvent pas un gain identique sur le réseau Cloudflare. Les mesures distantes confirment que la production actuelle diffuse déjà son corps HTML progressivement ; aucune règle de compression Cloudflare n’a été changée.

À remesurer après déploiement du correctif : début de réponse, arrivée du texte principal, annuaire, navigation dans une vraie session utilisateur. Aucun score Lighthouse ou gain sur les pages authentifiées n’est annoncé à partir de ces mesures publiques.

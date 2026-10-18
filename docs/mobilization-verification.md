# Signataires et emailing — 18 octobre 2026

## Comportement livré

- La recherche et la ville des signataires s’appliquent avant la pagination,
  sans tenir compte de la casse. Valider avec Entrée ou « Rechercher ».
  L’URL conserve les critères et les pages hors limites sont recalées.
- Les compteurs d’audience donnent le total complet. Les envois immédiats
  acceptent jusqu’à 500 destinataires ; au-delà, le serveur refuse tout l’envoi.
  Une diffusion différée pour les audiences plus grandes reste à développer.
- Les tags d’emailing suivent la même comparaison exacte que la base des
  soutiens. « climat » n’inclut pas « microclimat ». Les emails vides sont exclus
  du compteur et de la sélection de destinataires.
- Le bouton d’envoi reste désactivé pendant la lecture du compteur, en cas
  d’erreur et si l’audience dépasse la limite. Une réponse d’un ancien segment
  ne peut pas réactiver le bouton avec un compteur périmé.
- Les erreurs de transport libèrent les boutons. Une erreur d’envoi ne déclenche
  aucune relance automatique : l’envoi peut avoir commencé côté serveur.
- La suppression et la conversion exigent une sélection explicite de 1 à 500
  signatures. Une sélection vide ou absente ne signifie plus « tout supprimer ».
- L’export complet refuse les pétitions au-delà de 50 000 signatures au lieu
  de fournir silencieusement un fichier partiel.

## Vérification

`node scripts/check-mobilization-actions.mjs` exécute les vraies actions avec
une base et un transport mail simulés : audience 500/501, compteurs complets,
absence de suppression avec une sélection vide, permissions, export hors
limite et transmission des critères de recherche au rendu serveur. Aucun
email ni écriture réelle n’est effectué. Le contrôle est ajouté à la CI.

La base accessible pendant cette intervention ne contient aucune pétition.
Le parcours signataires rempli est donc couvert par un jeu contrôlé et ne
constitue pas une recette avec des signatures réelles. Les contrôles CRM sur
contacts réels et le jeu SQL de tags sont distincts et restent en lecture seule.

La fusion, le déploiement Cloudflare et la réception de vrais emails ne sont
pas prouvés par ces contrôles locaux.

Aperçu compilé connecté : la page des soutiens s’affiche avec son état vide
réel. Le navigateur collaboratif s’est déconnecté avant la vérification des
fenêtres d’envoi ; leur recette visuelle n’est donc pas annoncée comme réussie.
Lint strict, validation Prisma, build Cloudflare et gardes CRM/cache passent.

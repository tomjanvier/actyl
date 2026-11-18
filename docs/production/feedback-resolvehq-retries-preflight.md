# Vérifier le schéma de reprise ResolveHQ

La migration de suivi des nouvelles tentatives est déjà versionnée dans le dépôt. Ce contrôle vérifie, sans écriture, si ses trois colonnes et son index existent sur la base **Neon main**.

**État observé le 2026-11-17 (résultats communiqués par Chef Dev) :** sur le projet `plaid-act` (`quiet-night-83637690`), le SQL de préflight a été exécuté en lecture seule sur la branche `main`, base `act` (`database=act`) : les trois colonnes (`resolvehqRetryCount`, `resolvehqLastAttemptAt`, `resolvehqNextRetryAt`) et l’index de reprise renvoient `false`. Pour `staging`, le contrôle rapporté est une description du schéma, qui indique également l’absence de ces colonnes et de l’index. La migration n’a pas été appliquée. Les colonnes de suivi doivent donc être créées sur la branche de base effectivement utilisée avant d’activer la reprise automatique en production.

**Nouveau recontrôle le 2026-11-18 à 12:43 UTC :** une requête `SELECT` en lecture seule sur la base `act` de `main` (`br-empty-star-b1jw0bws`) renvoie désormais `true` pour les trois colonnes et l’index. Le même contrôle avait renvoyé `false` plus tôt le 18 novembre. Cette vérification ne permet pas d’établir quand ni par quelle opération le schéma a changé. `staging` avait été décrit auparavant comme dépourvu de ces objets; il n’a pas été recontrôlé dans cette session. Aucune migration n’a été lancée pendant ce contrôle.

1. Ouvrir la console SQL de Neon et confirmer visuellement que la branche sélectionnée est `main`.
2. Exécuter [`check-feedback-resolvehq-retries.sql`](./check-feedback-resolvehq-retries.sql).
3. Vérifier que `resolvehqRetryCount`, `resolvehqLastAttemptAt`, `resolvehqNextRetryAt` et `resolvehq retry index` renvoient `true`.

Si un contrôle renvoie `false`, ne pas appliquer `db push` depuis le Worker. Faire d’abord une sauvegarde, puis appliquer le fichier déjà versionné `prisma/migrations/20261117180000_feedback_resolvehq_retries/migration.sql` selon la procédure de migration validée pour Actyl. Ne pas coller de secret ou d’URL de connexion dans un ticket, un journal ou le dépôt.

La procédure SQL ci-dessous reste le préflight reproductible. Aucun secret n’a été lu; aucune écriture ni migration n’a été effectuée.

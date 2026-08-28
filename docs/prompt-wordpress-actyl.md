# Prompt prêt à coller — Intégrer l'API Actyl dans l'extension WordPress `campagneplaidact`

> Ouvre le dépôt `tomjanvier/campagneplaidact` et applique ce cahier des charges.
> Il décrit exactement le contrat d'implémenté côté Actyl, donc aucune supposition n'est nécessaire.

---

## Contexte

Je développe **Actyl**, une plateforme de plaidoyer (Next.js) qui centralise contacts, pétitions, soutiens et emails. Mon extension WordPress **PLAID·ACT Core** (`plaidact-campaign-core`) gère déjà les pétitions (module Petitioner embarqué dans `vendor/petitioner`), la newsletter Brevo (`[plaid_newsletter_form]`) et les dons Givoly.

**Objectif : chaque action des visiteurs sur WordPress doit être poussée en temps réel vers mon instance Actyl via son API REST `/api/v1/*`, sans jamais casser le rendu WordPress si l'API est indisponible.**

## Contrat de l'API Actyl (déjà déployée — ne rien inventer)

Authentification sur toutes les routes : header `Authorization: Bearer actyl_xxxxxxxx…` (token créé dans Actyl → Réglages). Content-Type: `application/json`.

### 1. Test de connexion
```
GET {ACTYL_URL}/api/v1/ping
→ 200 {"ok":true,"workspaceId":"…"} | 401 si token invalide/révoqué
```

### 2. Signature de pétition
La pétition est identifiée par le **slug de sa campagne Actyl** dans l'URL :
```
POST {ACTYL_URL}/api/v1/petitions/{slug_campagne}/signatures
{"name":"Jean Martin","email":"jean@exemple.fr","city":"Rennes","tags":["wordpress"]}
→ 201/200 {"ok":true,"count":1234}   | 400 email invalide | 404 slug inexistant ou pétition non publiée
```
Idempotent : re-poster le même email met à jour au lieu de dupliquer. Rate-limit : 60 req/min/token.

### 3. Personne (newsletter, adhésion, formulaire libre)
```
POST {ACTYL_URL}/api/v1/supporters
{"email":"a@b.fr","fullName":"Jean Martin","city":"Rennes","phone":"+336…",
 "source":"newsletter","category":"SUPPORTER","tags":["newsletter-site"]}
→ 201/200 {"ok":true,"contactId":"…","created":true}
```
`source` max 60 caractères (ex : `"newsletter"`, `"wordpress:{nom_de_page}"`). `category` ∈ SUPPORTER | MEMBER | VOLUNTEER | DONOR.

### 4. Don (Givoly)
```
POST {ACTYL_URL}/api/v1/donations
{"email":"a@b.fr","fullName":"Jean Martin","amount":50,"provider":"givoly",
 "label":"Don campagne zones humides","occurredAt":"2026-08-24T12:00:00Z"}
→ 201 {"ok":true,"donationId":"…","contactId":"…"}
```
`amount` = montant en unités (50) ou `amountCents` (5000). Crée/enrichit le contact en catégorie DONOR automatiquement.

## Ce que je veux que tu implémentes dans le plugin

1. **Réglages** — nouvelle section « Connexion Actyl » dans **Réglages → PLAID·ACT** :
   - champ URL de l'instance (ex : `https://mon-instance.vercel.app`, stockée sans slash final) ;
   - champ token API (`actyl_…`), stocké avec `encrypt`/get_option standard, jamais affiché en clair après sauvegarde (masqué, bouton « afficher ») ;
   - case « Activer la synchronisation » (défaut : désactivée tant que le ping n'a pas réussi) ;
   - bouton **« Tester la connexion »** qui appelle `/api/v1/ping` et affiche le résultat inline (succès vert / message d'erreur HTTP précis) ;
   - réglage « Journal » simple (option WP) gardant les 100 derniers événements de sync (horodatage, endpoint, code HTTP) consultable dans la page réglages.

2. **Liaison pétition → campagne Actyl** — pour chaque pétition Petitioner, ajouter une metabox ou un champ de réglages « Slug de campagne Actyl » (champ texte + liste déroulante si tu peux lister les campagnes). Ne rien pousser si ce champ est vide ou si la synchro est désactivée.

3. **Poussée temps réel des signatures** — trouve dans `vendor/petitioner` le point d'accroche déclenché après l'enregistrement réussi d'une signature (action/filter du module, ou surcharge de sa classe d'insertion) et, à ce moment :
   - `wp_remote_post()` vers `/api/v1/petitions/{slug}/signatures` avec nom, email, ville ;
   - **non bloquant** pour l'utilisateur : timeout 5 s max, échec silencieux côté front, erreur journalisée dans le journal de sync ;
   - tags envoyés : `["wordpress", "{slug_pétition_wp}"]`.
   - planifier un retry unique différé (WP-Cron, +10 min) si le code retour est ≥ 500 ou si la requête échoue réseau ; pas de retry sur 4xx.

4. **Newsletter** — quand le formulaire `[plaid_newsletter_form]` inscrit quelqu'un (flux Brevo existant), poster aussi vers `/api/v1/supporters` avec `source:"newsletter"` et le tag `newsletter-site`. Même politique non bloquante.

5. **Dons Givoly** — à la confirmation de don (page `[givoly_form]`, où les coordonnées sont déjà préremplies), si tu peux capturer la confirmation côté serveur, poster vers `/api/v1/donations` avec `provider:"givoly"`. Si Givoly ne permet pas de capture fiable côté serveur, laisse un hook `plaidact_actyl_record_donation( $args )` documenté qu'un autre module pourra appeler, et ne simule pas l'envoi.

6. **Outil de rattrapage (backfill)** — dans la page de réglages Actyl : bouton « Synchroniser les signatures existantes » qui, par lots de 20 avec `usleep`/batch et reprise là où il s'est arrêté (option WP `plaidact_actyl_backfill_cursor`), repousse toutes les signatures Petitioner antérieures vers la campagne liée. Afficher la progression. Ajouter aussi une commande WP-CLI équivalente : `wp plaidact actyl-backfill --petition={id}`.

7. **Qualité & sécurité** :
   - tout le code dans `includes/class-plaidact-actyl.php` (classe singleton `PLAIDACT_Actyl`) + chargement conditionnel depuis `plaidact-campaign-core.php` ; respecte les conventions PHP/PSR du dépôt et le préfixe `plaidact_` ;
   - URLs validées (schéma https uniquement), timeouts courts, `wp_json_encode` pour les corps, `esc_html__` pour les chaînes (textdomain existant), compatibles Polylang si applicable ;
   - aucun appel API pendant les imports CSV ou opérations bulk existants ;
   - ajoute des tests manuels documentés à la fin du README (scénario : créer token Actyl → renseigner réglages → tester connexion → signer une pétition → vérifier dans Actyl que le signataire apparaît dans l'onglet « Signataires » de la campagne et dans la base Soutiens).

## Critères d'acceptation

- Désactivé par défaut ; zéro requête sortante tant que URL+token+activation ne sont pas validés par un ping réussi.
- Une signature WordPress apparaît en < 5 s dans Actyl (campagne correspondant au slug), avec doublon impossible si le formulaire est reposté.
- Si l'instance Actyl est hors ligne : le site WordPress continue de fonctionner normalement, l'échec est journalisé, un retry unique part via WP-Cron.
- Le backfill reprend après interruption sans dupliquer (l'API étant idempotente par email, rejouer un lot est sûr).

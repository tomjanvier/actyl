# Prompt maître Codex — Actyl + Givoly + plugin WordPress `campagneplaidact`

> Copie-colle l'intégralité de ce document à Codex. Il couvre 3 chantiers dans 3 dépôts,
> à exécuter **dans l'ordre A → B → C** (B et C dépendent des contrats de A).
> Règle d'or : **tout contrat Actyl ci-dessous est recopié du code en production —
> ne jamais l'inventer ni le « deviner », et le re-vérifier dans le dépôt avant de coder.**

---

## 0. Repères (ne pas modifier sans demander)

| Élément | Valeur |
|---|---|
| Actyl (plateforme, source de vérité) | ce dépôt (`actyl`, Next.js 15, App Router, Prisma, `lib/`, `app/api/`) |
| Act = fournisseur d'identité OIDC (c'est Actyl lui-même, `lib/oidc.ts`) | prod `https://act.plaidact.org` (variable `ACT_OIDC_ISSUER`) |
| Plugin WordPress | dépôt `tomjanvier/campagneplaidact` (fichier `plaidact-campaign-core.php`, classe `PLAIDACT_Actyl`, préfixe `plaidact_`) |
| Givoly (dons) | dépôt Givoly — **commence par l'explorer** (stack inconnue a priori, voir §4) |
| Langue des interfaces | français uniquement |
| Implémentation client OIDC de référence | `lib/act-sso.ts` + `app/api/auth/act/start|callback/route.ts` (branche `act-sso-client`) : PKCE S256, `state` anti-CSRF à usage unique, cookies httpOnly, `safeNextPath` anti-open-redirect, mapping de rôles **additif** (on accorde, on ne rétrograde jamais). Reproduis ces patterns dans B et C. |

---

## 1. Contrats Actyl — API publique d'ingestion `/api/v1/*` (figés, déjà déployés)

Base : `{ACTYL_URL}` = origine publique de l'instance (ex. `https://actyl.org`).
Auth **sur toutes les routes** : header `Authorization: Bearer actyl_xxx…`
(token `actyl_` + 48 caractères hexadécimaux, créé dans Actyl → Paramètres → API & intégrations ;
seul un hash SHA-256 est stocké, révocable). Échec → **401 `{"error":"…"}`** (messages en français).
Corps exigés en JSON (`Content-Type: application/json`), objet uniquement.
**Rate-limit : 60 req/min par token + IP → 429 `{"error":"…"}`** (retry après délai, pas de retry sur 4xx).
CORS `*` sur `GET, POST, OPTIONS` (pré-vol `OPTIONS` → 204).

### 1.1 `GET {ACTYL_URL}/api/v1/ping` — test de connexion
→ 200 `{"ok":true,"workspaceId":"…"}` | 401 si token invalide/révoqué.

### 1.2 `POST {ACTYL_URL}/api/v1/petitions/{slug}/signatures` — signature de pétition
`{slug}` = **slug de la campagne Actyl** portant une pétition **publiée** (sinon 404).
```json
{"name":"Jean Martin","email":"jean@exemple.fr","city":"Rennes","tags":["wordpress","petition-locale"]}
```
- `name` : 2–80 caractères (requis). `email` valide (requis). `city`, `tags` (array ou string) optionnels.
- **Idempotent par email** (upsert : re-poster met à jour, ne duplique jamais).
- Le serveur ajoute lui-même les tags `petition` + début du slug.
- → **toujours 201** `{"ok":true,"count":1234}` | 400 email/nom invalide | 404 slug inexistant ou pétition non publiée.

### 1.3 `POST {ACTYL_URL}/api/v1/supporters` — personne (newsletter, adhésion, formulaire)
```json
{"email":"a@b.fr","fullName":"Jean Martin","city":"Rennes","phone":"+336…",
 "source":"newsletter","category":"SUPPORTER","tags":["newsletter-site"]}
```
- `category` ∈ `SUPPORTER | MEMBER | VOLUNTEER | DONOR` (défaut `SUPPORTER`).
- `source` ≤ 60 caractères (défaut `"newsletter"`). `firstName`/`lastName` acceptés en alternative à `fullName`.
- Si `source` ou un tag contient « newsletter » **et** que l'espace a configuré Brevo, Actyl inscrit aussi côté newsletter et renvoie `newsletterStatus`.
- → **201 si créé, 200 si mis à jour** `{"ok":true,"contactId":"…","created":true,"newsletterStatus":null|"…"} | 400.

### 1.4 `POST {ACTYL_URL}/api/v1/donations` — don (Givoly)
```json
{"email":"a@b.fr","fullName":"Jean Martin","amount":50,"provider":"givoly",
 "label":"Don campagne zones humides","occurredAt":"2026-08-24T12:00:00Z","currency":"EUR"}
```
- `amount` (unités, ex. 50) **ou** `amountCents` (ex. 5000) — **requis**, > 0, max 1 000 000 €.
- `provider` ≤ 40 car. (`"givoly"`), `label` ≤ 160, `currency` = code ISO à 3 lettres (défaut `EUR`).
- Crée le don + passe le contact en segment `DONOR` + alimente la base Soutiens (`source:"donation"`).
- ⚠️ **NON idempotent : chaque POST crée une ligne de don.** Côté appelant, marquer chaque paiement
  (`actyl_donation_id` persisté) et **ne jamais re-poster un paiement déjà marqué synchronisé**.
  Retry/backfill uniquement pour les paiements sans marque.
- → **toujours 201** `{"ok":true,"donationId":"…","contactId":"…"} | 400 (montant requis/hors limites, email invalide).

---

## 2. Contrats Actyl — Fournisseur OIDC « Se connecter avec Act » (figé, déjà déployé)

- Découverte : `GET {ACT_ISSUER}/.well-known/openid-configuration`
  (`issuer`, `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint`, `end_session_endpoint`).
  En prod l'émetteur est `https://act.plaidact.org`. **Toujours découvrir les endpoints, jamais les coder en dur.**
- Flux unique : **Authorization Code + PKCE S256**. Codes : 60 s, usage unique. Tokens d'accès opaques, 1 h.
  `token_endpoint_auth_methods_supported` : `none` (client public PKCE) ou `client_secret_post` (si secret configuré).
- `GET {ACT_ISSUER}/oauth/authorize` — paramètres : `response_type=code`, `client_id` (préalablement enregistré),
  `redirect_uri` (**correspondance exacte** avec une URI enregistrée), `scope` contenant `openid`
  (recommandé : `openid email profile`), `state` (anti-CSRF), `code_challenge` + `code_challenge_method=S256`.
  Si l'utilisateur n'est pas connecté sur Act : redirection vers le login Act puis reprise automatique.
  Erreurs → `invalid_client | invalid_request | invalid_scope` (400).
- `POST {ACT_ISSUER}/oauth/token` (`application/x-www-form-urlencoded`) : `grant_type=authorization_code`,
  `code`, `redirect_uri` (identique), `client_id`, `code_verifier` (+ `client_secret` si le client en a un).
  → 200 `{"access_token":"…","token_type":"Bearer","expires_in":3600,"scope":"…"}`.
- `GET {ACT_ISSUER}/oauth/userinfo` (header `Authorization: Bearer …`)
  → 200 `{"sub":"…","email":"…","email_verified":true,"name":"…","roles":["admin","member",…]}`
  (`sub` = identifiant stable ; `roles` = rôles Actyl en minuscules). **Faire foi uniquement à `userinfo`
  côté serveur, jamais à un token décodé côté client.** Refuser si email absent.
- `GET {ACT_ISSUER}/oauth/end-session` — termine la session Act (à appeler au logout local, après avoir
  détruit la session locale).
- Enregistrement d'un client (à faire faire par un admin Act, une fois par environnement) :
  `POST {ACT_ISSUER}/api/admin/oidc/clients` (session admin Act) avec
  `{"client_id":"…","name":"…","redirect_uris":["https://…/callback-exact"],"client_secret":"…?"}` —
  URIs `https://` uniquement, secret optionnel (absent = client public PKCE). → 201.
- Mapping de rôles recommandé (additif, jamais de rétrogradation) : `admin` → rôle local max ;
  autres rôles → équivalent local le plus proche (`member`, rôle éditeur, observateur…) ; défaut = rôle le moins privilégié.

---

## 3. CHANTIER A — Actyl (ce dépôt) : finir le côté serveur pour B et C

Contexte : le fournisseur OIDC (`lib/oidc.ts`, routes `app/oauth/*`, `app/.well-known/*`,
`app/api/admin/oidc/clients`) et l'ingestion (`app/api/v1/*`) existent. Il manque :
(1) un endpoint de **listing** pour que WordPress propose les campagnes en dropdown/backfill,
(2) l'**écran admin de révocation** OIDC annoncé comme « à venir » dans `docs/oidc.md`.

### Tâches
A1. **`GET /api/v1/petitions`** (auth Bearer, rate-limit 60, CORS et helpers de `lib/api.ts`) :
    liste des pétitions **publiées** de l'espace : `[{slug, title, count, isPublished}]`
    (`slug` = slug de la campagne, `count` = nombre de signatures). Tri alpha. 200 + `OPTIONS` 204.
A2. **`GET /api/v1/petitions/{slug}`** : détail `{slug, title, isPublished, count}` | 404 si inconnue/non publiée.
A3. **Admin OIDC** (réservé super-admin/ADMIN, UI en français dans le dashboard) :
    liste des clients (`client_id`, nom, URIs, `revokedAt`, date création), bouton **Révoquer/Réactiver**
    (pose `revokedAt`, ne supprime jamais — les tokens existants doivent cesser de fonctionner),
    et révocation des tokens d'accès d'un client. Vérifier que `authorize`/`token`/`userinfo`
    rejettent un client révoqué (déjà codé via `revokedAt` — écrire un test manuel qui le prouve).
A4. **Qualité** : `pnpm typecheck` + `pnpm lint` verts, `prisma generate`, conventions du repo
    (français, `apiJson`/`apiError`, `cleanStr`/`validEmail` pour toute entrée), schéma Prisma inchangé
    sauf si indispensable (alors `prisma db push` sur base de test + comptages).
    Documenter les 2 nouveaux endpoints dans `README.md` (§ API) et les scénarios de test manuel.

### Acceptation A
- `curl` avec token valide : `/ping` 200, `/petitions` 200, `/petitions/{slug}` 200/404 ; token bidon → 401 partout ; 61e requête/min → 429.
- Un client OIDC révoqué ne peut plus obtenir ni utiliser de token ; l'UI l'affiche.
- Aucune régression : `typecheck`, `lint`, build OK.

---

## 4. CHANTIER B — Plugin WordPress `campagneplaidact` : ingestion + SSO

Dépôt `tomjanvier/campagneplaidact`. **D'abord**, explore-le (structure, `vendor/petitioner`,
`[plaid_newsletter_form]`, `[givoly_form]`, page Réglages, textdomain, préfixe `plaidact_`,
compatibilité Polylang) et **adapte les points d'accroche** à ce que tu y trouves — les noms
de hooks/filtres ci-dessous sont indicatifs si le module diffère.

### B1. Ingestion temps réel (contrats §1 — relis-les, ils corrigent l'ancien prompt)
1. Section « Connexion Actyl » dans Réglages → URL instance (https, sans slash final), token `actyl_…`
   (masqué après sauvegarde + bouton afficher), case d'activation (défaut OFF), bouton **« Tester la connexion »**
   (`GET /ping`, résultat inline vert/rouge avec code HTTP), journal des 100 derniers appels (horodatage,
   endpoint, code HTTP).
2. Par pétition Petitioner : champ « Slug de campagne Actyl » (+ **dropdown alimenté par `GET /api/v1/petitions`**
   quand la connexion est valide, repli champ libre). Rien n'est poussé si vide ou synchro OFF.
3. Après signature enregistrée : `wp_remote_post()` → `POST /petitions/{slug}/signatures`
   (nom, email, ville, tags `["wordpress","{slug_wp}"]`), **timeout 5 s**, non bloquant (échec silencieux front,
   journalisé). **Un seul retry différé** (WP-Cron +10 min) si ≥ 500 ou erreur réseau ; jamais sur 4xx.
   Attendre **201** (pas 200).
4. Newsletter : après inscription Brevo, `POST /supporters` (`source:"newsletter"`, tag `newsletter-site`).
   Gérer `created`/`newsletterStatus` dans le journal (info, pas d'erreur si `newsletterStatus:null`).
5. Dons : si confirmation Givoly capturable côté serveur → `POST /donations` (`provider:"givoly"`),
   **avec marquage anti-doublon** (le endpoint n'est pas idempotent, cf §1.4). Sinon, exposer le hook
   documenté `plaidact_actyl_record_donation($args)` et ne rien simuler.
6. Backfill : bouton « Synchroniser les signatures existantes » (lots de 20, curseur persistant
   `plaidact_actyl_backfill_cursor`, progression affichée) + commande WP-CLI
   `wp plaidact actyl-backfill --petition={id}`. Rejouer est sûr pour signatures/supporters (idempotents) ;
   **exclure les dons du backfill aveugle** (uniquement paiements non marqués).
7. Code dans `includes/class-plaidact-actyl.php` (singleton `PLAIDACT_Actyl`), chargé conditionnellement,
   `wp_json_encode`, `esc_*__`, timeouts courts, aucun appel pendant imports CSV/bulk.

### B2. SSO « Se connecter avec Act » (contrat §2)
1. Réglages : `issuer` (défaut `https://act.plaidact.org`), `client_id`, `client_secret` (vide = public PKCE),
   URIs de rappel enregistrées au préalable côté Act via §2 (une par environnement).
2. Bouton sur `wp-login.php` : génère `state` + `code_verifier`/`code_challenge` (S256), stocke en transients
   httpOnly/short-lived, redirige vers `authorize` (endpoints via discovery, jamais en dur).
3. Callback : vérifie `state` (usage unique), échange form-urlencoded, puis `GET userinfo` côté serveur ;
   retrouve/crée l'utilisateur WP **par `sub` d'abord** (meta `plaidact_act_sub`, unique), sinon par email
   (lie sans écraser mot de passe/capacités existantes) ; mappe les rôles (additif, défaut = abonné) ;
   ouvre la session WP ; protège contre l'open-redirect (redirection locale relative uniquement).
4. Logout : détruit la session WP **puis** redirige vers `end-session`.
5. Journalise les échecs (sans secrets) dans le journal du §B1.

### Acceptation B
- OFF par défaut : zéro requête sortante tant que URL + token + activation validés par ping.
- Signature WP visible dans Actyl en < 5 s, sans doublon au re-post ; Actyl hors ligne → site intact + retry unique.
- Login Act complet : nouvel utilisateur créé avec `sub` lié, retour existant relié par email sans perte,
  rôles mappés, `state` non rejouable, `next` local uniquement.
- README du plugin : scénarios manuels bout-en-bout (ping → signature → vérification onglet Signataires +
  base Soutiens ; login/logout SSO ; backfill avec reprise).

---

## 5. CHANTIER C — Givoly : SSO + remontée des dons

**Étape 0 — exploration obligatoire** : cartographie du dépôt Givoly (stack, framework, auth/session existante,
où le paiement est confirmé côté serveur, comment appeler une API externe, où stocker des secrets, système
de jobs/files d'attente). Note tes constats en 10 lignes max en tête de ta réponse, puis implémente.

### Tâches
C1. **SSO « Se connecter avec Act »** : même contrat §2 et mêmes patterns qu'en B2 (discovery, PKCE S256,
`state` usage unique, `userinfo` seule source de vérité, liaison par `sub` puis email sans écraser
l'existant, mapping de rôles additif, session locale conservée, logout via `end-session`).
Client OIDC **distinct** de WordPress (`client_id` dédié, redirect_uris propres, enregistré côté Act via §2).
C2. **Remontée des dons vers Actyl** (`POST /api/v1/donations`, contrat §1.4) déclenchée **uniquement sur
confirmation de paiement côté serveur** (webhook prestataire vérifié ou statut interne `paid` — jamais sur
simple affichage de page) : `{email, fullName, amount|amountCents, currency, provider:"givoly", label,
occurredAt}` + tags utiles. Timeouts courts, échec non bloquant pour le donateur, journalisé.
C3. **Anti-doublon strict** (endpoint non idempotent) : persister `actyl_donation_id` sur le paiement ;
ne poster que si absent ; job de rattrapage uniquement pour les paiements `paid` sans marque.
C4. **Réglages** : URL Actyl + token Bearer (secret, jamais exposé au front), issuer/client OIDC, bouton de test
(ping + discovery), journal des appels.
C5. Docs : scénarios manuels (don → visible dans Actyl avec bon montant ; double webhook → un seul don ;
login/logout SSO ; révocation du token → 401 journalisée sans crash).

### Acceptation C
- Un paiement confirmé = **exactement un** don dans Actyl même si le webhook est livré 3 fois.
- SSO : création/liaison par `sub`, pas d'élévation de privilèges, sessions locales conservées.
- Secrets uniquement côté serveur ; aucune régression du tunnel de don (mesurer avant/après si possible).

---

## 6. Règles globales (non négociables)

1. **Contrats d'abord** : toute divergence entre ce prompt et le code d'Actyl → le code gagne, signale-le et adapte-toi.
2. **Sécurité** : secrets jamais loggés ni exposés au front ; `state` aléatoire ≥ 128 bits, usage unique, TTL ≤ 10 min ;
   `redirect_uri` exacte et pré-enregistrée ; `next` local relatif uniquement ; validation/assainissement de toute entrée.
3. **Résilience** : timeous courts (≤ 5 s), dégradation gracieuse (le site/le don ne cassent jamais si Actyl/Act est down),
   retry uniquement sur 5xx/réseau (jamais 4xx), backoff raisonnable.
4. **Preuve par exécution** : à chaque chantier, montre les commandes lancées et leurs sorties
   (`curl -i` avec codes HTTP, tests, typecheck/lint) — pas de « ça devrait marcher ».
5. **Commits** : un commit par chantier/sous-partie, messages courts, jamais de secret dans Git
   (`git status` propre, fichiers `.env` ignorés). Ne push/merge que sur instruction explicite.
6. **Questions** : si un point d'accroche (hook Petitioner, confirmation Givoly) est introuvable après
   recherche sérieuse, propose le hook documenté + le plan B au lieu d'inventer un appel.

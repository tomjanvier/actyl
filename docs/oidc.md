# Fournisseur OIDC Act

Act expose un fournisseur OpenID Connect sous `https://act.plaidact.org` pour
les sites PLAID·ACT. Le flux pris en charge est Authorization Code avec PKCE
S256. Les codes sont courts (60 secondes), à usage unique, et les jetons
d'accès sont opaques, hashés en base et valables une heure.

## Découverte et endpoints

- `GET /.well-known/openid-configuration`
- `GET /oauth/authorize`
- `POST /oauth/token`
- `GET /oauth/userinfo`
- `GET /oauth/end-session`
- `POST /api/admin/oidc/clients` pour un administrateur Act

Un client est enregistré avec un identifiant, un nom et une ou plusieurs URLs
de rappel HTTPS exactes. Le secret est optionnel pour les clients publics qui
utilisent PKCE ; pour Actyl en production il est obligatoire. Lorsqu'il est
utilisé, seul son hash est conservé. Exemple WordPress :

`https://site.example/wp-admin/admin-post.php?action=plaidact_act_sso_callback`

## Réponse userinfo

`userinfo` renvoie `sub`, `email`, `email_verified`, `name` et `roles`. `sub`
est l'identifiant stable de l'utilisateur Act. Les rôles sont issus de toutes
ses adhésions Act et renvoyés en minuscules (`admin`, `campaigner`, `member`,
`observer`). Le client consommateur peut les mapper vers ses rôles locaux.

## Configuration

Définir `ACT_OIDC_ISSUER=https://act.plaidact.org` dans l'environnement de
production. Ne jamais utiliser un émetteur HTTP hors environnement local.

WordPress et Givoly doivent conserver leur propre session locale après le
rappel OIDC ; le logout centralisé est disponible pour terminer la session Act.
Les clients sont administrés dans **Paramètres → API & intégrations**. Une
révocation conserve le client mais invalide immédiatement ses jetons d'accès ;
une réactivation n'annule pas cette révocation des anciens jetons.

## Clients de production PLAID·ACT

Act est le fournisseur commun. Enregistrer un client OIDC distinct par outil,
avec exactement ces URI de retour :

| Outil | `client_id` | URI de retour |
|---|---|---|
| Extension WordPress PLAID·ACT | `wp-plaidact` | `https://plaidact.org/wp-admin/admin-post.php?action=plaidact_act_sso_callback` |
| Actyl | `actyl-prod` | `https://actyl.org/api/auth/act/callback` |
| Givoly | `givoly-prod` | `https://app.givoly.org/api/auth/callback/act` |

En production, Actyl exige `ACT_SSO_ISSUER=https://act.plaidact.org`,
`ACT_SSO_CLIENT_ID=actyl-prod`, `ACT_SSO_CLIENT_SECRET` et
`NEXT_PUBLIC_APP_URL=https://actyl.org`. Le secret doit correspondre au client
Act et ne peut pas être relu après création. `AUTH_SECRET` et `DATABASE_URL`
doivent également être configurés. Pour le premier rattachement d'un compte
sans espace existant, renseigner le workspace cible via
`ACT_SSO_WORKSPACE_SLUG` ou `ACT_SSO_WORKSPACE_ID`.

Givoly utilise `ACT_OIDC_ISSUER`, `ACT_OIDC_CLIENT_ID` et
`ACT_OIDC_CLIENT_SECRET`, avec `NEXT_PUBLIC_APP_URL=https://app.givoly.org`.
WordPress utilise les réglages « Connexion Act (SSO) » et doit avoir son module
SSO activé. Conserver les trois secrets dans les secrets Workers respectifs ou
dans le stockage protégé WordPress, jamais dans Git.

La présence de ces réglages ne prouve pas un login complet. Valider chaque
outil avec un compte Act actif et vérifié : découverte OIDC, redirection vers
le callback exact, échange du code PKCE, création/liaison additive du compte,
accès à la session locale puis déconnexion. Le logout Act termine la session
centrale; les sessions locales des applications restent indépendantes.

## Scénario manuel de révocation

1. Obtenir un code puis un jeton d'accès pour un client actif et vérifier que
   `GET /oauth/userinfo` répond 200.
2. Révoquer ce client depuis **Paramètres → API & intégrations**.
3. Vérifier que le même jeton reçoit désormais `401 invalid_token` sur
   `userinfo`, que `authorize` refuse le client et que `token` refuse tout code
   encore en attente.
4. Réactiver le client : un nouveau flux peut aboutir, mais l'ancien jeton reste
   révoqué.

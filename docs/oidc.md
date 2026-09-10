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
de rappel HTTPS exactes. Le secret est optionnel ; lorsqu'il est utilisé,
seul son hash est conservé. Exemple WordPress :

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
La révocation administrative des clients et des jetons fera l'objet d'un écran
d'administration dédié avant activation à grande échelle.

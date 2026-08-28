# Packs de référence

Les packs sont installés à la demande dans un espace. Leur contenu reste une
liste partagée : tous les membres peuvent proposer un ajout, une modification,
un retrait ou un attribut, mais l’administrateur valide avant publication.

La route `/api/cron/reference-packs` est appelée chaque lundi à 04:00 UTC par
Vercel (`vercel.json`). Elle lit les sources publiques, compare les entrées
normalisées et crée des propositions. Elle ne supprime ni ne modifie jamais
directement un contact. La variable `CRON_SECRET` doit être configurée dans
Vercel pour autoriser l’appel.

Sources utilisées :

- Député·e·s : données ouvertes de l’Assemblée nationale ;
- Sénateur·rice·s : données ouvertes du Sénat ;
- Eurodéputé·e·s : API ouverte du Parlement européen ;
- Élu·e·s de Paris : jeu `conseillers-de-paris` de Paris Data ;
- Élu·e·s régionaux et départementaux : Répertoire national des élus,
  publié sous Licence Ouverte par le ministère de l’Intérieur.

Les suppressions proposées par une source sont explicitement marquées « à
confirmer » afin de ne pas confondre absence temporaire et fin de mandat.

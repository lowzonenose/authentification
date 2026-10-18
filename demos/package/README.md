# Démo simple : authentification OIDC et Vue Router

Application multi-pages utilisant le package local `@lowzonenose/authentification-vue-oidc`.
Le plugin est installé une seule fois dans [src/main.js](src/main.js), avant le routeur.
Toutes les pages accèdent à la session avec `useAuth()`, sans Pinia ni persistance dans `localStorage`.

## Pages

| Route | Contenu |
| --- | --- |
| `/` | Connexion / déconnexion SSO |
| `/profil` | Profil OIDC et rôles ; route protégée |
| `/session` | État public de la session, sans affichage des jetons |

## Fonctionnement

- Connexion Authorization Code + PKCE et déconnexion IdP avec `login()` / `logout()`.
- Traitement du callback sur la page Connexion et restauration de la destination par `createAuthGuard()`.
- Restauration silencieuse au démarrage ; les vues attendent la fin de `initializing`.
- Stockage mémoire par défaut, `session` disponible par configuration explicite.
- Logger debug désactivé par défaut ; l'activer avec `IAM_DEBUG=true`.

## Configuration

Utiliser [.env.example](.env.example) comme référence dans `.env`.
Ce fichier local est conservé lors de la migration. Les noms `IAM_*` existants restent acceptés ;
les équivalents `VITE_IAM_*` sont également acceptés, avec priorité aux noms `IAM_*`.
Ces valeurs sont publiques : aucun secret ne doit y figurer.

| Variable | Utilisation |
| --- | --- |
| `IAM_AUTHORITY` | Issuer OIDC complet, ou utiliser `IAM_URL` avec `IAM_REALM` |
| `IAM_CLIENT_ID` | Client public enregistré dans l'IdP, requis |
| `IAM_REDIRECT_URI` | Callback, par défaut l'origine + `/package/` |
| `IAM_POST_LOGOUT_REDIRECT_URI` | Retour après logout, par défaut l'origine + `/package/` |
| `IAM_SILENT_REDIRECT_URI` | Callback iframe, par défaut l'origine + `/package/silent-renew.html` |
| `IAM_SCOPE` | Défaut : `openid profile email` |
| `IAM_STORAGE` | `memory` par défaut, ou `session` |
| `IAM_DEBUG` | `true` pour afficher les logs `[auth]` et leurs durées ; désactivé par défaut |

Enregistrer dans l'IdP les URI de callback et de renouvellement correspondant au port du serveur.
Par défaut : `http://localhost:4173/package/` et `http://localhost:4173/package/silent-renew.html`.
L'URI de retour après déconnexion doit également être autorisée.
Si Vite choisit un autre port, adapter les URI côté IdP et dans la configuration.
Le chemin de base peut être modifié avec la variable shell `BASE_URL` avant le lancement.

## Lancement

```sh
# À la racine du dépôt /demos/package
npm install
npm run build
npm run preview
```

Ouvrir l'URL annoncée par Vite avec le chemin `http://localhost:4173/package/`.

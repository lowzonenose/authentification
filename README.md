# ![image](docs/cartes-gouv-logo.svg) authentification-vue-oidc

Librairie JavaScript ESM d'authentification OIDC pour Vue 3. 

Elle enveloppe `oidc-client-ts` et expose des déclarations TypeScript strictes.

Le client est une SPA publique : aucun `client_secret` ne doit être fourni.

## 📦 Installation

```sh
npm config set @lowzonenose:registry https://npm.pkg.github.com
npm login --scope=@lowzonenose --auth-type=legacy --registry=https://npm.pkg.github.com
npm install @lowzonenose/authentification-vue-oidc vue
```

Lors de `npm login`, utilise ton nom d'utilisateur GitHub et un Personal Access
Token (classic) avec la permission `read:packages` comme mot de passe.

`vue` est une dépendance paire (peerDependency). 
`vue-router` est optionnelle et nécessaire uniquement au guard de routes.

## ⚡ Démarrage

```js
import { createApp } from 'vue'
import { createAuth } from '@lowzonenose/authentification-vue-oidc'
import App from './App.vue'

const auth = createAuth({
  authority: 'https://sso.example.org/realms/my-realm',
  clientId: 'my-public-client',
  redirectUri: `${window.location.origin}/auth/callback`,
  postLogoutRedirectUri: window.location.origin,
  silentRedirectUri: `${window.location.origin}/silent-renew.html`,
  scope: 'openid profile email',
})

createApp(App).use(auth).mount('#app')
```

Dans un composant Vue :

```js
<script setup>
import { useAuth } from '@lowzonenose/authentification-vue-oidc'

const { user, status, isAuthenticated, login, logout } = useAuth()
</script>

<template>
  <p v-if="status === 'initializing'">Chargement…</p>
  <button v-else-if="!isAuthenticated" @click="login()">Se connecter</button>
  <div v-else>
    <span>Bonjour {{ user?.name }}</span>
    <button @click="logout()">Se déconnecter</button>
  </div>
</template>
```

`createAuth()` retourne un plugin *opaque*.
`useAuth()` est le seul accès à l'état et aux actions, dans `setup()` comme dans du code externe, après installation du plugin.

La classe interne `Logger` utilise `vue-logger-plugin` et émet des messages `debug` dans la console.
Les logs sont **désactivés par défaut** : les activer avec `debug: true` ou `IAM_DEBUG=true` (via `authOptionsFromEnv`).

L'option `logger` est un callback complémentaire appelé pour ces mêmes entrées ; son contexte ne contient que le niveau et des noms d'événements, états, codes d'erreur, durées ou indicateurs booléens :

```js
const auth = createAuth({
  authority: 'https://sso.example.org/realms/app',
  clientId: 'app-public',
  redirectUri: `${window.location.origin}/auth/callback`,
  debug: true,
  logger: (message, context) => sendToMonitoring({ message, context }),
})
```

Une fois activés, les messages debug sont envoyés à la console. `logger` permet de les rediriger vers l'observabilité applicative.

La librairie ne journalise jamais d'access/refresh token, de claim, d'URL de retour, de message d'erreur brut ni de `cause`. Une exception levée par le logger est ignorée et ne modifie pas le flux d'authentification.

Les actions du noyau sont profilées : chaque action émet `<action> started`, puis `<action> completed` ou `<action> failed` avec `durationMs`. 

Exemple lors d'un rafraîchissement de page :

```text
[auth] plugin installed
[auth] initialization started
[auth] stored session lookup started
[auth] stored session lookup completed { durationMs: 1.2 }
[auth] silent restore started
[auth] silent restore completed { durationMs: 412.7 }
[auth] initialization completed { status: 'authenticated', durationMs: 415.3 }
```

Actions mesurées : `initialization`, `callback processing`, `stored session lookup`, `silent restore`, `silent renew`, `access token request`, `token refresh after 401`, `login redirect`, `logout redirect`.

## ⚙️ Configuration

Les options `authority`, `clientId` et `redirectUri` sont requises. L'autorité et les URI doivent être en HTTPS, sauf localhost en HTTP. Les URI de callback/logout/renouvellement doivent être sur l'origine de l'application.

La mémoire est le stockage de tokens par défaut. `storage: 'session'` ou un `StorageAdapter` peut être fourni explicitement.

`silentRestore` est activé par défaut. `silentRedirectUri` doit être une page servie par l'application qui relaie le callback iframe au parent selon le protocole `oidc-client-ts`; la page d'exemple est dans [demos/advanced/public](demos/advanced/public).

Configuration par variables publiques :

```js
import { authOptionsFromEnv, createAuth } from '@lowzonenose/authentification-vue-oidc'

const env = import.meta.env
const auth = createAuth({
  ...authOptionsFromEnv({
    IAM_AUTHORITY: env.VITE_IAM_AUTHORITY,
    IAM_URL: env.VITE_IAM_URL,
    IAM_REALM: env.VITE_IAM_REALM,
    IAM_CLIENT_ID: env.VITE_IAM_CLIENT_ID,
    IAM_REDIRECT_URI: env.VITE_IAM_REDIRECT_URI,
    IAM_POST_LOGOUT_REDIRECT_URI: env.VITE_IAM_POST_LOGOUT_REDIRECT_URI,
    IAM_SCOPE: env.VITE_IAM_SCOPE,
    IAM_STORAGE: env.VITE_IAM_STORAGE,
    IAM_DEBUG: env.VITE_IAM_DEBUG,
  }),
  silentRedirectUri: env.VITE_IAM_SILENT_REDIRECT_URI,
})
```

`authOptionsFromEnv` attend les clés `IAM_*` ci-dessous et ne lit aucun environnement elle-même :

| Clé fournie au helper | Option | Requise | Règle |
|---|---|---:|---|
| `IAM_AUTHORITY` | `authority` | Alternative | Issuer complet, prioritaire sur `IAM_URL` + `IAM_REALM` |
| `IAM_URL` | `authority` | Alternative | URL de base de l'IdP, à fournir avec `IAM_REALM` |
| `IAM_REALM` | `authority` | Alternative | Realm, à fournir avec `IAM_URL` |
| `IAM_CLIENT_ID` | `clientId` | Oui | Identifiant du client public |
| `IAM_REDIRECT_URI` | `redirectUri` | Oui | URI de callback enregistrée dans l'IdP |
| `IAM_POST_LOGOUT_REDIRECT_URI` | `postLogoutRedirectUri` | Non | URI après logout |
| `IAM_SCOPE` | `scope` | Non | Scopes séparés par des espaces ; défaut `openid` |
| `IAM_STORAGE` | `storage` | Non | `memory` (défaut) ou `session` |
| `IAM_DEBUG` | `debug` | Non | `true` active les logs ; désactivés par défaut |

Les options directement passées à `createAuth()` priment sur les valeurs du helper, puis viennent les défauts. `IAM_AUTHORITY` ou l'option `authority` remplace le couple `IAM_URL` + `IAM_REALM`. Les variables `IAM_*` contenant `secret` dans leur nom (par exemple `IAM_CLIENT_SECRET`) sont rejetées. `silentRedirectUri` est une option directe et n'est pas lue par le helper.

Pour une configuration runtime, passe un objet chargé par l'application :

```js
const runtimeEnv = await fetch('/config.json').then((response) => response.json())
const auth = createAuth(authOptionsFromEnv(runtimeEnv))
```

Avec Vite, la démo fait explicitement la correspondance depuis les noms `VITE_IAM_*` (voir [demos/advanced/.env.example](demos/advanced/.env.example)). `VITE_IAM_SILENT_REDIRECT_URI` est ensuite passée séparément à `createAuth()` comme `silentRedirectUri`. Les variables `VITE_*` sont publiques et intégrées au bundle ; n'y place aucun secret.
Un modèle complet de configuration Vite est également disponible à la racine dans [.env.example](.env.example).

| Variable Vite de la démo | Clé helper / option | Requise | Remarque |
|---|---|---:|---|
| `VITE_IAM_AUTHORITY` | `authority` via `IAM_AUTHORITY` | Alternative | Issuer complet ; prioritaire sur URL + realm |
| `VITE_IAM_URL` | `authority` via `IAM_URL` | Alternative | À fournir avec `VITE_IAM_REALM` |
| `VITE_IAM_REALM` | `authority` via `IAM_REALM` | Alternative | À fournir avec `VITE_IAM_URL` |
| `VITE_IAM_CLIENT_ID` | `clientId` via `IAM_CLIENT_ID` | Oui | Identifiant public, aucun secret |
| `VITE_IAM_REDIRECT_URI` | `redirectUri` via `IAM_REDIRECT_URI` | Oui | Doit être autorisée exactement dans l'IdP |
| `VITE_IAM_POST_LOGOUT_REDIRECT_URI` | `postLogoutRedirectUri` via `IAM_POST_LOGOUT_REDIRECT_URI` | Non | URI après logout |
| `VITE_IAM_SCOPE` | `scope` via `IAM_SCOPE` | Non | Scopes séparés par espaces |
| `VITE_IAM_STORAGE` | `storage` via `IAM_STORAGE` | Non | `memory` (défaut) ou `session` |
| `VITE_IAM_DEBUG` | `debug` via `IAM_DEBUG` | Non | `true` active les logs |
| `VITE_IAM_SILENT_REDIRECT_URI` | `silentRedirectUri` | Non | Option directe ; page callback de même origine |

## 🧩 Vue Router

```js
import { createAuthGuard } from '@lowzonenose/authentification-vue-oidc'

router.beforeEach(createAuthGuard({ forbiddenRoute: '/forbidden' }))
```

Le guard attend la fin de l'initialisation, protège `meta.requiresAuth`, vérifie les rôles de `meta.roles` et exclut les callbacks marqués `meta.isAuthCallback` ou listés dans `callbackRouteNames`. Les rôles front-end sont indicatifs ; l'API reste responsable de l'autorisation.

## 🧩 Requêtes API

```js
import { createAuthFetch } from '@lowzonenose/authentification-vue-oidc'

const apiFetch = createAuthFetch()
const response = await apiFetch('https://api.example.org/v1/profile')
```

Déclare `apiBaseUrls` à l'installation du plugin. Le token est ajouté uniquement aux origines/préfixes autorisés. Sur `401`, le helper tente un seul renouvellement et une seule nouvelle requête.

## 🧩 Événements

`useAuth().on(event, handler)` retourne une fonction de désabonnement. 

Événements disponibles :`login`, `logout`, `tokenRefreshed`, `sessionExpired` et `error`. 

`resetAuth()` est réservé aux tests.

## ✅ Tests

```sh
npm ci
npm test
npm run test:coverage
npm run type
npm run lint
npm run build
npm run ci
```

`npm run ci` exécute les contrôles suivants : ESLint avec complexité cyclomatique maximale de 15, moins de 650 lignes runtime non vides, budget de 15 KiB gzip pour la librairie seule (Vue, Vue Router et `oidc-client-ts` externalisés), tests, type des déclarations et `npm audit`.

La couverture se mesure séparément avec `npm run test:coverage` et n'est pas un gate CI pour l'instant : le dernier rapport était de 76,36 % de lignes. Le seuil de 80 % reste à atteindre avant de l'activer.

## 🎬 Démonstration

La démo interactive et son guide de configuration IdP sont dans [demos/advanced/README.md](demos/advanced/README.md).

La démo multi-pages simple est dans [demos/simple/README.md](demos/simple/README.md).

## Licence et changements

* Licence AGPL : [LICENSE](LICENSE).
* Historique des versions : [CHANGELOG](CHANGELOG.md).

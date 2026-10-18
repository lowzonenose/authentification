# Référence API

Une référence générée par TypeDoc est disponible via `npm run docs` (sortie : `docs/reference/`).

Les déclarations TypeScript publiées sont dans `types/index.d.ts`. Les exports runtime sont ESM et restent indépendants des types internes de `oidc-client-ts`.

## `createAuth(options)`

Retourne un plugin Vue opaque, à installer avec `app.use(createAuth(options))`.

Options :

| Option | Type | Défaut | Règle |
|---|---|---|---|
| `authority` | `string` | — | Issuer OIDC HTTPS (HTTP localhost accepté) |
| `clientId` | `string` | — | Identifiant du client public |
| `redirectUri` | `string` | — | URI de callback sur l'origine de l'application |
| `postLogoutRedirectUri` | `string` | `window.location.origin` côté adaptateur | URI de retour après logout |
| `scope` | `string` | `'openid'` | Scopes OIDC |
| `storage` | `'memory' \| 'session' \| StorageAdapter` | `'memory'` | Stockage de l'utilisateur/tokens |
| `silentRestore` | `boolean` | `true` | Restauration silencieuse au démarrage |
| `silentRedirectUri` | `string` | — | Callback iframe de même origine |
| `apiBaseUrls` | `string[]` | `[]` | Bases auxquelles le helper HTTP peut envoyer un Bearer |
| `onError` | `(error: AuthError) => void` | — | Abonnement global à `error` |
| `logger` | `Logger` | — | Callback d'observabilité complémentaire, appelé seulement si `debug` est actif |
| `debug` | `boolean` | `false` | Active les logs debug (console + `logger`) ; `IAM_DEBUG=true` via `authOptionsFromEnv` |

`authority`, `redirectUri` et `clientId` sont requis après résolution des options. 

Les options explicites passées à `createAuth()` priment sur les valeurs issues de `authOptionsFromEnv(env)`.

### Logger

La classe interne `Logger` s'appuie sur `vue-logger-plugin`. Elle est désactivée par défaut : aucun message n'est émis (ni console, ni callback) tant que `debug` ne vaut pas `true`.

`logger(message, context)` est un callback optionnel qui reçoit les messages de niveau `debug` (`context.level === 'debug'`).

Les seuls champs contextuels émis par le noyau sont `event`, `status`, `code`, `returnToProvided`, `promptProvided` et `durationMs`.

Les valeurs de returnTo elles-mêmes, utilisateurs/claims, tokens, messages bruts et causes d'erreur ne sont jamais transmis.

Les exceptions du logger et du callback sont absorbées.

## `useAuth()`

À appeler après l'installation. Tous les appels partagent le même singleton.

| Propriété / action | Contrat |
|---|---|
| `user` | `Readonly<Ref<AuthUser \| null>>`, avec `sub`, claims de profil et rôles ergonomiques |
| `isAuthenticated` | `Readonly<Ref<boolean>>` |
| `status` | `initializing`, `unauthenticated`, `authenticating`, `authenticated`, `refreshing` ou `error` |
| `error` | `Readonly<Ref<AuthError \| null>>` |
| `login(options?)` | Redirection Authorization Code + PKCE S256 ; `returnTo` est limité à la même origine |
| `logout(options?)` | Fin de session locale puis RP-Initiated Logout |
| `getAccessToken()` | Token valide, ou erreur typée ; un refresh échoué expire la session |
| `hasRole(role)` | Vérification ergonomique uniquement ; l'API doit autoriser réellement |
| `on(event, handler)` | Abonnement typé, retourne `() => void`; les exceptions d'un handler sont isolées |

`AuthEventMap` définit les charges utiles : `login(AuthUser)`, `error(AuthError)` et aucun argument pour `logout`, `tokenRefreshed`, `sessionExpired`.

## `authOptionsFromEnv(env)`

Accepte un objet `Record<string, string | undefined>` sans lire `import.meta.env` ni `process.env`. 

Variables : `IAM_AUTHORITY`, ou `IAM_URL` + `IAM_REALM`, `IAM_CLIENT_ID`, `IAM_REDIRECT_URI`, `IAM_POST_LOGOUT_REDIRECT_URI`, `IAM_SCOPE`, `IAM_STORAGE`, `IAM_DEBUG`. 

Toute variable `IAM_*` dont le nom contient `secret` est rejetée.

## `createAuthGuard(options?)`

Options : `forbiddenRoute?: string | RouteLocationRaw` et `callbackRouteNames?: string[]`.

Protège `meta.requiresAuth`, attend la fin de l'initialisation et accepte `meta.roles`.

Les routes `meta.isAuthCallback` sont toujours exclues.

## `createAuthFetch(baseFetch?)`

Retourne un `fetch` compatible.

Sans base autorisée dans `apiBaseUrls`, aucun token n'est joint.

Pour une URL autorisée, `401` déclenche au plus un refresh et une seule nouvelle tentative.

## `resetAuth()` et erreurs

`resetAuth()` est destiné aux tests : il appelle `dispose()`, libère les abonnements et fait que `useAuth()` lève `NOT_INSTALLED` jusqu'à une nouvelle installation.

`AuthError.code` appartient à `AuthErrorCode` : `CONFIG_INVALID`, `NOT_INSTALLED`, `DISCOVERY_FAILED`, `STATE_MISMATCH`, `NONCE_MISMATCH`, `TOKEN_EXCHANGE_FAILED`, `TOKEN_EXPIRED`, `REFRESH_FAILED`, `LOGIN_REQUIRED`, `NETWORK_ERROR`, `ACCESS_DENIED`.
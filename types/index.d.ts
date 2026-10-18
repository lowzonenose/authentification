/**
 * Authentification OIDC (Authorization Code + PKCE) pour Vue 3, basée sur `oidc-client-ts`.
 *
 * @packageDocumentation
 */
import type { Ref, Plugin } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

/**
 * Codes stables des erreurs d'authentification, utilisables pour la traduction côté application.
 *
 * @category Erreurs
 */
export type AuthErrorCode =
  /** Configuration absente, invalide ou non sécurisée. */
  | 'CONFIG_INVALID'
  /** `useAuth()` ou un helper est appelé avant `app.use(createAuth(...))`. */
  | 'NOT_INSTALLED'
  /** Initialisation OIDC (découverte de l'IdP) impossible. */
  | 'DISCOVERY_FAILED'
  /** Le `state` du callback ne correspond à aucune requête en cours. */
  | 'STATE_MISMATCH'
  /** Le nonce de l'ID token ne correspond pas à la requête. */
  | 'NONCE_MISMATCH'
  /** Échec de la redirection vers l'IdP ou de l'échange du code. */
  | 'TOKEN_EXCHANGE_FAILED'
  /** Aucun access token valide n'est disponible. */
  | 'TOKEN_EXPIRED'
  /** Échec du renouvellement silencieux de la session. */
  | 'REFRESH_FAILED'
  /** L'IdP exige une authentification interactive. */
  | 'LOGIN_REQUIRED'
  /** Erreur réseau, par exemple lors de la déconnexion auprès de l'IdP. */
  | 'NETWORK_ERROR'
  /** Rôle requis absent pour accéder à la route. */
  | 'ACCESS_DENIED'

/**
 * Erreur émise par la librairie. Le message est destiné au diagnostic ;
 * `cause` ne doit jamais être affichée à l'utilisateur.
 *
 * @category Erreurs
 */
export class AuthError extends Error {
  /** Code stable de l'erreur. */
  readonly code: AuthErrorCode
  /**
   * @param code - Code stable de l'erreur.
   * @param message - Message de diagnostic.
   * @param options - Erreur d'origine éventuelle.
   */
  constructor(code: AuthErrorCode, message: string, options?: { cause?: unknown })
}

/**
 * Stockage personnalisé des données de session (utilisateur et tokens).
 *
 * @category Configuration
 */
export interface StorageAdapter {
  /** Retourne la valeur associée à `key`, ou `null` si absente. */
  get(key: string): string | null
  /** Enregistre `value` sous `key`. */
  set(key: string, value: string): void
  /** Supprime la valeur associée à `key`. */
  remove(key: string): void
}

/**
 * Utilisateur authentifié.
 *
 * @category État
 */
export interface AuthUser {
  /** Identifiant unique du sujet (`sub`). */
  sub: string
  /** Nom affichable, si fourni par l'IdP. */
  name?: string
  /** Adresse e-mail, si fournie par l'IdP. */
  email?: string
  /**
   * Rôles fusionnés et dédupliqués : `realm_access.roles`,
   * `resource_access[clientId].roles` et `roles`.
   */
  roles: string[]
  /** Claims de l'access token et du profil. */
  claims: Record<string, unknown>
}

/**
 * État du cycle de vie de l'authentification.
 *
 * @category État
 */
export type AuthStatus =
  /** Restauration de session en cours au démarrage. */
  | 'initializing'
  /** Aucune session active. */
  | 'unauthenticated'
  /** Redirection vers l'IdP en cours. */
  | 'authenticating'
  /** Session active. */
  | 'authenticated'
  /** Renouvellement de session en cours. Réservé : non affecté par la version actuelle. */
  | 'refreshing'
  /** Erreur bloquante, voir {@link UseAuth.error}. */
  | 'error'

/**
 * Signature des handlers par événement, utilisée par {@link UseAuth.on}.
 *
 * @category Événements
 */
export interface AuthEventMap {
  /** Une session vient d'être établie. */
  login: (user: AuthUser) => void
  /** L'utilisateur s'est déconnecté. */
  logout: () => void
  /** Les tokens de la session active ont été renouvelés. */
  tokenRefreshed: () => void
  /** La session a expiré ou n'a pas pu être renouvelée. */
  sessionExpired: () => void
  /** Une erreur d'authentification est survenue. */
  error: (error: AuthError) => void
}

/**
 * Nom d'un événement d'authentification.
 *
 * @category Événements
 */
export type AuthEventName = keyof AuthEventMap

/**
 * Options de {@link createAuth}.
 *
 * Les URL doivent être en HTTPS (HTTP accepté pour localhost) ; les URI de callback,
 * de logout et de renouvellement doivent être sur l'origine de l'application.
 *
 * @category Configuration
 */
export interface AuthOptions {
  /** Issuer OIDC, par exemple `https://sso.example.org/realms/app`. */
  authority: string
  /** Identifiant du client public. Aucun secret client n'est accepté. */
  clientId: string
  /** URI de callback enregistrée dans l'IdP. */
  redirectUri: string
  /**
   * URI de retour après déconnexion.
   * @defaultValue `window.location.origin`
   */
  postLogoutRedirectUri?: string
  /**
   * Scopes OIDC séparés par des espaces.
   * @defaultValue `'openid'`
   */
  scope?: string
  /**
   * Stockage de l'utilisateur et des tokens.
   * @defaultValue `'memory'`
   */
  storage?: 'memory' | 'session' | StorageAdapter
  /**
   * Restaure silencieusement la session au démarrage.
   * @defaultValue `true`
   */
  silentRestore?: boolean
  /** Page de même origine relayant le callback de l'iframe de renouvellement. */
  silentRedirectUri?: string
  /**
   * Bases d'URL auxquelles {@link createAuthFetch} ajoute le Bearer token.
   * @defaultValue `[]`
   */
  apiBaseUrls?: string[]
  /** Abonnement global à l'événement `error`. */
  onError?: (error: AuthError) => void
  /**
   * Callback recevant les messages debug, appelé seulement si {@link AuthOptions.debug} est actif.
   * Le contexte ne contient jamais de token, claim ni message d'erreur brut.
   */
  logger?: (message: string, context?: Record<string, unknown>) => void
  /**
   * Active les logs debug (console et {@link AuthOptions.logger}), avec la durée des actions.
   * @defaultValue `false`
   */
  debug?: boolean
}

/**
 * Options partielles, telles que produites par {@link authOptionsFromEnv}.
 *
 * @category Configuration
 */
export type AuthOptionsInput = Partial<AuthOptions>

/**
 * API d'authentification retournée par {@link useAuth}.
 *
 * @category Composable
 */
export interface UseAuth {
  /** Utilisateur courant, ou `null`. */
  user: Readonly<Ref<AuthUser | null>>
  /** `true` si une session est active. */
  isAuthenticated: Readonly<Ref<boolean>>
  /** État courant du cycle d'authentification. */
  status: Readonly<Ref<AuthStatus>>
  /** Dernière erreur, ou `null`. */
  error: Readonly<Ref<AuthError | null>>
  /**
   * Redirige vers l'IdP pour se connecter.
   *
   * @param options.returnTo - Chemin de même origine restauré après connexion.
   * @param options.prompt - Paramètre OIDC `prompt` (par exemple `login`).
   * @param options.loginHint - Paramètre OIDC `login_hint`.
   * @throws {@link AuthError} `CONFIG_INVALID` si `returnTo` est hors origine,
   *   `TOKEN_EXCHANGE_FAILED` si la redirection échoue.
   */
  login(options?: { returnTo?: string; prompt?: string; loginHint?: string }): Promise<void>
  /**
   * Termine la session locale puis redirige vers l'IdP pour se déconnecter.
   *
   * @param options.returnTo - URI de même origine utilisée après déconnexion.
   * @throws {@link AuthError} `NETWORK_ERROR` si la déconnexion IdP échoue.
   */
  logout(options?: { returnTo?: string }): Promise<void>
  /**
   * Retourne un access token valide, en le renouvelant silencieusement si nécessaire.
   *
   * @throws {@link AuthError} `TOKEN_EXPIRED` ou `REFRESH_FAILED` ; la session est alors terminée.
   */
  getAccessToken(): Promise<string>
  /** Indique si l'utilisateur courant possède `role`. */
  hasRole(role: string): boolean
  /**
   * Abonne `handler` à `event`.
   *
   * @returns Fonction de désabonnement.
   */
  on<E extends AuthEventName>(event: E, handler: AuthEventMap[E]): () => void
}

/**
 * Callback de journalisation, voir {@link AuthOptions.logger}.
 *
 * @category Configuration
 */
export type Logger = NonNullable<AuthOptions['logger']>

/**
 * Options de {@link createAuthGuard}.
 *
 * @category Router
 */
export interface AuthGuardOptions {
  /** Route de redirection quand un rôle requis manque ; sinon la navigation est annulée. */
  forbiddenRoute?: string | RouteLocationRaw
  /** Noms des routes de callback, en complément de `meta.isAuthCallback`. */
  callbackRouteNames?: string[]
}

/**
 * Crée le plugin Vue d'authentification. Une seule instance peut être installée.
 *
 * @example
 * ```js
 * app.use(createAuth({
 *   authority: 'https://sso.example.org/realms/app',
 *   clientId: 'app-public',
 *   redirectUri: `${window.location.origin}/auth/callback`,
 * }))
 * ```
 * @throws {@link AuthError} `CONFIG_INVALID` si la configuration est invalide.
 * @category Plugin
 */
export function createAuth(options: AuthOptionsInput): Plugin

/**
 * Retourne l'API d'authentification partagée, dans `setup()` ou hors composant.
 *
 * @throws {@link AuthError} `NOT_INSTALLED` si le plugin n'est pas installé.
 * @category Composable
 */
export function useAuth(): UseAuth

/**
 * Désinstalle l'instance courante et supprime les abonnements. Réservé aux tests.
 *
 * @category Plugin
 */
export function resetAuth(): void

/**
 * Convertit un objet de variables `IAM_*` en options. Ne lit aucun environnement lui-même.
 *
 * Clés lues : `IAM_AUTHORITY` (ou `IAM_URL` + `IAM_REALM`), `IAM_CLIENT_ID`, `IAM_REDIRECT_URI`,
 * `IAM_POST_LOGOUT_REDIRECT_URI`, `IAM_SCOPE`, `IAM_STORAGE`, `IAM_DEBUG`.
 *
 * @example
 * ```js
 * createAuth(authOptionsFromEnv({ IAM_CLIENT_ID: import.meta.env.VITE_IAM_CLIENT_ID }))
 * ```
 * @throws {@link AuthError} `CONFIG_INVALID` si une clé `IAM_*` contient `secret`.
 * @category Configuration
 */
export function authOptionsFromEnv(env: Record<string, string | undefined>): AuthOptionsInput

/**
 * Crée un guard Vue Router appliquant `meta.requiresAuth` et `meta.roles`,
 * et restaurant la destination après connexion.
 *
 * @example
 * ```js
 * router.beforeEach(createAuthGuard({ forbiddenRoute: '/forbidden' }))
 * ```
 * @category Router
 */
export function createAuthGuard(options?: AuthGuardOptions): import('vue-router').NavigationGuard

/**
 * Crée un `fetch` qui ajoute le Bearer token aux URL de {@link AuthOptions.apiBaseUrls}
 * et rejoue une fois la requête après renouvellement sur réponse 401.
 *
 * @param baseFetch - Implémentation `fetch` sous-jacente.
 * @category HTTP
 */
export function createAuthFetch(baseFetch?: typeof fetch): typeof fetch
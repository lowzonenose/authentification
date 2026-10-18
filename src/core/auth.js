import { readonly, ref } from 'vue'
import { createOidcClientTsClient } from '../adapters/oidc-client-ts.js'
import { createApiUrlMatcher } from './api-urls.js'
import { resolveAuthOptions } from './config.js'
import { AuthError } from './errors.js'
import { Logger } from './logger.js'

let context

function debug(auth, message, details = {}) {
  auth.logger.debug(message, details)
}

function emit(auth, event, ...args) {
  debug(auth, 'event emitted', { event })
  for (const handler of [...(auth.handlers.get(event) ?? [])]) {
    try {
      handler(...args)
    } catch {
      // Une exception d’abonné ne doit pas bloquer les handlers suivants.
    }
  }
}

function applySession(auth, session) {
  auth.user.value = session?.user ?? null
  auth.isAuthenticated.value = session !== null
  auth.status.value = session ? 'authenticated' : 'unauthenticated'
}

function validatedReturnTo(returnTo) {
  if (!returnTo) return undefined
  let url
  try {
    url = new URL(returnTo, window.location.origin)
  } catch {
    throw new AuthError('CONFIG_INVALID', 'returnTo doit être une URL valide')
  }
  if (url.origin !== window.location.origin) {
    throw new AuthError('CONFIG_INVALID', 'returnTo doit rester sur la même origine')
  }
  return `${url.pathname}${url.search}${url.hash}`
}

export function createAuth(options) {
  const resolvedOptions = resolveAuthOptions(options)
  return {
    install(app) {
      if (context) throw new AuthError('CONFIG_INVALID', 'Une instance d’authentification est déjà installée')
      const logger = new Logger(resolvedOptions.logger, resolvedOptions.debug)
      logger.install(app)
      const handlers = new Map()
      const isApiUrl = createApiUrlMatcher(resolvedOptions.apiBaseUrls)
      const user = ref(null)
      const isAuthenticated = ref(false)
      const status = ref('initializing')
      const error = ref(null)
      const auth = { logger }

      const client = createOidcClientTsClient(resolvedOptions, {
        onSessionChanged(session) {
          const wasAuthenticated = auth.isAuthenticated.value
          applySession(auth, session)
          emit(auth, wasAuthenticated ? 'tokenRefreshed' : 'login', ...(wasAuthenticated ? [] : [session.user]))
        },
        onSessionEnded(reason) {
          const wasAuthenticated = auth.isAuthenticated.value
          applySession(auth, null)
          if (reason === 'logout') {
            if (wasAuthenticated) emit(auth, 'logout')
          } else emit(auth, 'sessionExpired')
        },
        onError(authError) {
          if (auth.status.value === 'initializing') auth.startupRestoreFailed = true
          error.value = authError
          status.value = 'unauthenticated'
          debug(auth, 'authentication error', { code: authError.code })
          emit(auth, 'error', authError)
        },
      }, { logger })

      const api = {
        user: readonly(user),
        isAuthenticated: readonly(isAuthenticated),
        status: readonly(status),
        error: readonly(error),
        async login(loginOptions) {
          const returnTo = validatedReturnTo(loginOptions?.returnTo)
          auth.startupRestoreFailed = false
          status.value = 'authenticating'
          try {
            await logger.measure('login redirect', () =>
              client.login({ ...loginOptions, ...(returnTo ? { returnTo } : {}) }), {
              returnToProvided: Boolean(returnTo),
              promptProvided: Boolean(loginOptions?.prompt),
            })
          } catch (cause) {
            const authError = new AuthError('TOKEN_EXCHANGE_FAILED', 'Échec de la redirection vers l’IdP', { cause })
            error.value = authError
            status.value = 'error'
            debug(auth, 'login redirect failed', { code: authError.code })
            emit(auth, 'error', authError)
            throw authError
          }
        },
        async logout(logoutOptions) {
          const returnTo = validatedReturnTo(logoutOptions?.returnTo)
          applySession(auth, null)
          emit(auth, 'logout')
          try {
            await logger.measure('logout redirect', () => client.logout({ ...(returnTo ? { returnTo } : {}) }), {
              returnToProvided: Boolean(returnTo),
            })
          } catch (cause) {
            const authError = new AuthError('NETWORK_ERROR', 'Échec de la déconnexion auprès de l’IdP', { cause })
            error.value = authError
            status.value = 'error'
            debug(auth, 'logout failed', { code: authError.code })
            emit(auth, 'error', authError)
            throw authError
          }
        },
        async getAccessToken() {
          try {
            return await logger.measure('access token request', () => client.getAccessToken())
          } catch (cause) {
            const authError = cause instanceof AuthError
              ? cause
              : new AuthError('TOKEN_EXPIRED', 'Impossible d’obtenir un access token valide', { cause })
            error.value = authError
            if (authError.code === 'TOKEN_EXPIRED' || authError.code === 'REFRESH_FAILED') {
              applySession(auth, null)
              emit(auth, 'sessionExpired')
            }
            debug(auth, 'access token request failed', { code: authError.code })
            emit(auth, 'error', authError)
            throw authError
          }
        },
        hasRole(role) {
          return user.value?.roles.includes(role) ?? false
        },
        on(event, handler) {
          const subscribers = handlers.get(event) ?? new Set()
          subscribers.add(handler)
          handlers.set(event, subscribers)
          return () => {
            subscribers.delete(handler)
            if (subscribers.size === 0) handlers.delete(event)
          }
        },
      }

      Object.assign(auth, {
        client, user, isAuthenticated, status, error, handlers, isApiUrl,
        pendingReturnTo: undefined, startupRestoreFailed: false, api,
      })
      context = auth
      if (resolvedOptions.onError) api.on('error', resolvedOptions.onError)
      debug(auth, 'plugin installed')
      const endInitialization = logger.start('initialization')
      void client.init().then(({ session, returnTo }) => {
        if (context !== auth) return
        auth.pendingReturnTo = returnTo ? validatedReturnTo(returnTo) : undefined
        applySession(auth, session)
        endInitialization('completed', { status: auth.status.value })
      }).catch((cause) => {
        if (context !== auth) return
        const authError = cause instanceof AuthError
          ? cause
          : new AuthError('DISCOVERY_FAILED', 'Initialisation OIDC impossible', { cause })
        error.value = authError
        status.value = 'error'
        endInitialization('failed', { code: authError.code })
        emit(auth, 'error', authError)
      })
    },
  }
}

export function useAuth() {
  if (!context) throw new AuthError('NOT_INSTALLED', 'Appelez app.use(createAuth(...)) avant useAuth()')
  return context.api
}

export function resetAuth() {
  if (!context) return
  debug(context, 'test reset requested')
  context.client.dispose()
  context.handlers.clear()
  context = undefined
}

export function isConfiguredApiUrl(input, relativeTo) {
  if (!context) throw new AuthError('NOT_INSTALLED', 'Appelez app.use(createAuth(...)) avant createAuthFetch()')
  return context.isApiUrl(input, relativeTo)
}

export function refreshAccessTokenAfterUnauthorized() {
  if (!context) throw new AuthError('NOT_INSTALLED', 'Appelez app.use(createAuth(...)) avant createAuthFetch()')
  return context.logger.measure('token refresh after 401', () => context.client.refreshAccessToken())
}

export function consumeAuthReturnTo() {
  if (!context) return undefined
  const returnTo = context.pendingReturnTo
  context.pendingReturnTo = undefined
  return returnTo
}

export function reportAuthError(authError) {
  if (!context) throw new AuthError('NOT_INSTALLED', 'Le plugin d’authentification n’est pas installé')
  context.error.value = authError
  emit(context, 'error', authError)
}

export function shouldSuppressAutomaticLogin() {
  return context?.startupRestoreFailed ?? false
}
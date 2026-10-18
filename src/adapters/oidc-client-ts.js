import { ErrorResponse, InMemoryWebStorage, UserManager, WebStorageStateStore } from 'oidc-client-ts'
import { AuthError } from '../core/errors.js'
import { decodeJwtPayload, extractRoles } from '../core/claims.js'

const CALLBACK_PARAMS = ['code', 'state', 'session_state', 'iss', 'error', 'error_description']

function toSession(user, clientId) {
  const claims = { ...decodeJwtPayload(user.access_token), ...user.profile }
  return {
    accessToken: user.access_token,
    expiresAt: user.expires_at ?? 0,
    ...(user.id_token ? { idToken: user.id_token } : {}),
    user: {
      sub: user.profile.sub,
      ...(user.profile.name ? { name: user.profile.name } : {}),
      ...(user.profile.email ? { email: user.profile.email } : {}),
      roles: extractRoles(claims, clientId),
      claims,
    },
  }
}

function isLoginRequired(error) {
  return error instanceof ErrorResponse &&
    (error.error === 'login_required' || error.error === 'interaction_required')
}

function mapCallbackError(error) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('No matching state found')) {
    return new AuthError('STATE_MISMATCH', 'Le state du callback ne correspond à aucune requête en cours', { cause: error })
  }
  if (message.includes('nonce in id_token does not match')) {
    return new AuthError('NONCE_MISMATCH', 'Le nonce de l’ID token ne correspond pas à la requête', { cause: error })
  }
  if (isLoginRequired(error)) {
    return new AuthError('LOGIN_REQUIRED', 'Une authentification interactive est requise', { cause: error })
  }
  return new AuthError('TOKEN_EXCHANGE_FAILED', 'Échec du traitement du retour de l’IdP', { cause: error })
}

export function createOidcUserStorage(storage) {
  if (storage === 'session') return window.sessionStorage
  if (storage === 'memory') return new InMemoryWebStorage()
  const keys = new Set()
  return {
    get length() { return keys.size },
    clear() {
      keys.forEach((key) => storage.remove(key))
      keys.clear()
    },
    getItem(key) { return storage.get(key) },
    key(index) { return [...keys][index] ?? null },
    removeItem(key) {
      storage.remove(key)
      keys.delete(key)
    },
    setItem(key, value) {
      storage.set(key, value)
      keys.add(key)
    },
  }
}

function cleanCallbackUrl() {
  const url = new URL(window.location.href)
  CALLBACK_PARAMS.forEach((parameter) => url.searchParams.delete(parameter))
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

function createNonce() {
  return Array.from(window.crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export function createOidcClientTsClient(options, events, dependencies = {}) {
  const userStore = new WebStorageStateStore({ store: createOidcUserStorage(options.storage) })
  const manager = new UserManager({
    authority: options.authority,
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    post_logout_redirect_uri: options.postLogoutRedirectUri ?? window.location.origin,
    ...(options.silentRedirectUri ? { silent_redirect_uri: options.silentRedirectUri } : {}),
    scope: options.scope,
    response_type: 'code',
    userStore,
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
    automaticSilentRenew: false,
  }, dependencies.redirectNavigator)
  const step = (action, operation) => dependencies.logger?.measure(action, operation) ?? operation()
  const onLoaded = (user) => {
    manager.startSilentRenew()
    events.onSessionChanged(toSession(user, options.clientId))
  }
  const onExpired = () => events.onSessionEnded('expired')
  const onRenewError = () => events.onSessionEnded('refresh_failed')
  const onUnloaded = () => events.onSessionEnded('logout')
  manager.events.addUserLoaded(onLoaded)
  manager.events.addAccessTokenExpired(onExpired)
  manager.events.addSilentRenewError(onRenewError)
  manager.events.addUserUnloaded(onUnloaded)

  return {
    async init() {
      const params = new URLSearchParams(window.location.search)
      if (params.has('state') && (params.has('code') || params.has('error'))) {
        const callbackUrl = window.location.href
        cleanCallbackUrl()
        try {
          const user = await step('callback processing', () => manager.signinCallback(callbackUrl))
          if (!user) return { session: null }
          return {
            session: toSession(user, options.clientId),
            ...(typeof user.state === 'string' ? { returnTo: user.state } : {}),
          }
        } catch (error) {
          throw mapCallbackError(error)
        }
      }
      if (!options.silentRestore) return { session: null }
      const stored = await step('stored session lookup', () => manager.getUser())
      if (stored && !stored.expired) {
        manager.startSilentRenew()
        return { session: toSession(stored, options.clientId) }
      }
      try {
        const user = await step('silent restore', () => manager.signinSilent())
        if (user) manager.startSilentRenew()
        return { session: user ? toSession(user, options.clientId) : null }
      } catch (error) {
        if (!isLoginRequired(error)) {
          events.onError(new AuthError('REFRESH_FAILED', 'Restauration silencieuse impossible', { cause: error }))
        }
        return { session: null }
      }
    },
    login(loginOptions) {
      return manager.signinRedirect({
        nonce: createNonce(),
        ...(loginOptions?.returnTo ? { state: loginOptions.returnTo } : {}),
        ...(loginOptions?.prompt ? { prompt: loginOptions.prompt } : {}),
        ...(loginOptions?.loginHint ? { extraQueryParams: { login_hint: loginOptions.loginHint } } : {}),
      })
    },
    logout(logoutOptions) {
      const postLogoutRedirectUri = logoutOptions?.returnTo ?? options.postLogoutRedirectUri
      return manager.signoutRedirect(postLogoutRedirectUri ? { post_logout_redirect_uri: postLogoutRedirectUri } : {})
    },
    async getAccessToken() {
      const user = await step('stored session lookup', () => manager.getUser())
      if (user && !user.expired && user.access_token) return user.access_token
      try {
        const renewed = await step('silent renew', () => manager.signinSilent())
        if (renewed?.access_token) return renewed.access_token
      } catch (error) {
        throw new AuthError('REFRESH_FAILED', 'Échec du renouvellement de la session', { cause: error })
      }
      throw new AuthError('TOKEN_EXPIRED', 'Aucun access token valide')
    },
    async refreshAccessToken() {
      try {
        const user = await step('silent renew', () => manager.signinSilent())
        if (!user?.access_token) throw new AuthError('REFRESH_FAILED', 'Aucun token retourné après renouvellement')
        manager.startSilentRenew()
        return user.access_token
      } catch (error) {
        if (error instanceof AuthError) throw error
        throw new AuthError('REFRESH_FAILED', 'Échec du renouvellement de la session', { cause: error })
      }
    },
    dispose() {
      manager.events.removeUserLoaded(onLoaded)
      manager.events.removeAccessTokenExpired(onExpired)
      manager.events.removeSilentRenewError(onRenewError)
      manager.events.removeUserUnloaded(onUnloaded)
      manager.stopSilentRenew()
    },
  }
}
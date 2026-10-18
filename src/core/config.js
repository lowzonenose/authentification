import { AuthError } from './errors.js'
import { createApiUrlMatcher } from './api-urls.js'

function validateSecureUrl(value, variableName) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new AuthError('CONFIG_INVALID', `${variableName} doit être une URL valide`)
  }
  const localHosts = ['localhost', '127.0.0.1', '[::1]']
  const secure = url.protocol === 'https:' || (url.protocol === 'http:' && localHosts.includes(url.hostname))
  if (!secure) throw new AuthError('CONFIG_INVALID', `${variableName} doit utiliser HTTPS (sauf localhost)`)
}

function validateSameOrigin(value, variableName) {
  if (typeof window !== 'undefined' && new URL(value).origin !== window.location.origin) {
    throw new AuthError('CONFIG_INVALID', `${variableName} doit rester sur la même origine`)
  }
}

export function authOptionsFromEnv(env) {
  const secretNames = Object.keys(env).filter((name) =>
    name.startsWith('IAM_') && name.toLowerCase().includes('secret') && env[name] !== undefined,
  )
  if (secretNames.length) throw new AuthError('CONFIG_INVALID', `Variables interdites : ${secretNames.join(', ')}`)

  const authority = env.IAM_AUTHORITY ?? (env.IAM_URL && env.IAM_REALM
    ? `${env.IAM_URL.replace(/\/$/, '')}/realms/${env.IAM_REALM}`
    : undefined)
  return Object.fromEntries(Object.entries({
    authority,
    clientId: env.IAM_CLIENT_ID,
    redirectUri: env.IAM_REDIRECT_URI,
    postLogoutRedirectUri: env.IAM_POST_LOGOUT_REDIRECT_URI,
    scope: env.IAM_SCOPE,
    storage: env.IAM_STORAGE,
    debug: env.IAM_DEBUG === undefined ? undefined : String(env.IAM_DEBUG) === 'true',
  }).filter(([, value]) => value !== undefined))
}

function resolveUrl(value, variableName, required) {
  if (!value) {
    if (required) throw new AuthError('CONFIG_INVALID', `${variableName} est obligatoire`)
    return undefined
  }
  validateSecureUrl(value, variableName)
  return value
}

function resolveAuthUrls(options) {
  const authority = resolveUrl(options.authority, 'IAM_AUTHORITY', true)
  const redirectUri = resolveUrl(options.redirectUri, 'IAM_REDIRECT_URI', true)
  const postLogoutRedirectUri = resolveUrl(options.postLogoutRedirectUri, 'IAM_POST_LOGOUT_REDIRECT_URI', false)
  const silentRedirectUri = resolveUrl(options.silentRedirectUri, 'silentRedirectUri', false)
  validateSameOrigin(redirectUri, 'IAM_REDIRECT_URI')
  if (postLogoutRedirectUri) validateSameOrigin(postLogoutRedirectUri, 'IAM_POST_LOGOUT_REDIRECT_URI')
  if (silentRedirectUri) validateSameOrigin(silentRedirectUri, 'silentRedirectUri')
  return { authority, redirectUri, postLogoutRedirectUri, silentRedirectUri }
}

function resolveStorage(storage) {
  if (storage === undefined) return 'memory'
  if (storage !== undefined && storage !== 'memory' && storage !== 'session' && (storage === null || typeof storage !== 'object')) {
    throw new AuthError('CONFIG_INVALID', 'IAM_STORAGE doit valoir memory ou session')
  }
  return storage
}

export function resolveAuthOptions(options) {
  const urls = resolveAuthUrls(options)
  const storage = resolveStorage(options.storage)
  if (!options.clientId) throw new AuthError('CONFIG_INVALID', 'IAM_CLIENT_ID est obligatoire')
  createApiUrlMatcher(options.apiBaseUrls ?? [])

  return {
    authority: urls.authority,
    clientId: options.clientId,
    redirectUri: urls.redirectUri,
    postLogoutRedirectUri: urls.postLogoutRedirectUri,
    silentRedirectUri: urls.silentRedirectUri,
    scope: options.scope ?? 'openid',
    storage,
    silentRestore: options.silentRestore ?? true,
    apiBaseUrls: options.apiBaseUrls ?? [],
    onError: options.onError,
    logger: options.logger,
    debug: options.debug === true,
  }
}
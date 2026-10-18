import { AuthError } from './errors.js'

function isLocalhost(hostname) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
}

function normalizeBase(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new AuthError('CONFIG_INVALID', 'apiBaseUrls contient une URL non valide')
  }
  const secure = url.protocol === 'https:' || (url.protocol === 'http:' && isLocalhost(url.hostname))
  if (!secure || url.username || url.password || url.search || url.hash || raw.includes('*') || raw.includes('?') || raw.includes('#')) {
    throw new AuthError('CONFIG_INVALID', 'apiBaseUrls doit utiliser HTTPS et ne contenir ni identifiants, query, fragment ni joker')
  }
  return { origin: url.origin, pathname: url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/` }
}

export function createApiUrlMatcher(apiBaseUrls) {
  const bases = apiBaseUrls.map(normalizeBase)
  return (input, relativeTo = window.location.href) => {
    let url
    try {
      url = new URL(input, relativeTo)
    } catch {
      return false
    }
    const pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
    return bases.some((base) => url.origin === base.origin && pathname.startsWith(base.pathname))
  }
}
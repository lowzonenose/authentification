export function decodeJwtPayload(jwt) {
  try {
    const encoded = jwt.split('.')[1]
    if (!encoded) return {}
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return {}
  }
}

export function extractRoles(claims, clientId) {
  const realmAccess = claims.realm_access
  const resourceAccess = claims.resource_access
  const realmRoles = Array.isArray(realmAccess?.roles) ? realmAccess.roles : []
  const clientRoles = Array.isArray(resourceAccess?.[clientId]?.roles)
    ? resourceAccess[clientId].roles
    : []
  const genericRoles = Array.isArray(claims.roles) ? claims.roles : []
  return [...new Set([...realmRoles, ...clientRoles, ...genericRoles].filter((role) => typeof role === 'string'))]
}
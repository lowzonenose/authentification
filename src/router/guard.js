import { watch } from 'vue'
import { consumeAuthReturnTo, reportAuthError, shouldSuppressAutomaticLogin, useAuth } from '../core/auth.js'
import { AuthError } from '../core/errors.js'

function waitForInitialization(status) {
  if (status.value !== 'initializing') return Promise.resolve()
  return new Promise((resolve) => {
    const stop = watch(status, (currentStatus) => {
      if (currentStatus !== 'initializing') {
        stop()
        resolve()
      }
    })
  })
}

export function createAuthGuard(options = {}) {
  const callbackRouteNames = new Set(options.callbackRouteNames ?? [])
  return async (to) => {
    const auth = useAuth()
    await waitForInitialization(auth.status)
    const returnTo = consumeAuthReturnTo()
    if (returnTo && auth.isAuthenticated.value && to.fullPath !== returnTo) return returnTo

    const routeMeta = to.meta
    const isCallback = routeMeta.isAuthCallback === true ||
      (to.name !== undefined && callbackRouteNames.has(String(to.name)))
    if (isCallback || !routeMeta.requiresAuth) return true
    if (auth.status.value === 'error' || shouldSuppressAutomaticLogin()) return false
    if (!auth.isAuthenticated.value) {
      try {
        await auth.login({ returnTo: to.fullPath })
      } catch {
        return false
      }
      return false
    }

    if ((routeMeta.roles ?? []).every((role) => auth.hasRole(role))) return true
    reportAuthError(new AuthError('ACCESS_DENIED', 'Accès refusé : rôle requis absent'))
    return options.forbiddenRoute ?? false
  }
}
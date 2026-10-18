import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ref } from 'vue'
import type { AuthStatus } from '../src/core/types.js'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  consumeAuthReturnTo: vi.fn(),
  reportAuthError: vi.fn(),
  shouldSuppressAutomaticLogin: vi.fn(),
}))

vi.mock('../src/core/auth.js', () => mocks)

import { createAuthGuard } from '../src/router/guard.js'

function makeRouter(options: Parameters<typeof createAuthGuard>[0] = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/private', name: 'private', component: { template: '<div />' }, meta: { requiresAuth: true } },
      { path: '/admin', name: 'admin', component: { template: '<div />' }, meta: { requiresAuth: true, roles: ['admin'] } },
      { path: '/callback', name: 'callback', component: { template: '<div />' }, meta: { isAuthCallback: true } },
      { path: '/forbidden', name: 'forbidden', component: { template: '<div />' } },
    ],
  })
  router.beforeEach(createAuthGuard(options))
  return router
}

describe('createAuthGuard', () => {
  const status = ref<AuthStatus>('unauthenticated')
  const isAuthenticated = ref(false)
  const login = vi.fn()
  const hasRole = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    status.value = 'unauthenticated'
    isAuthenticated.value = false
    login.mockResolvedValue(undefined)
    hasRole.mockReturnValue(false)
    mocks.consumeAuthReturnTo.mockReturnValue(undefined)
    mocks.shouldSuppressAutomaticLogin.mockReturnValue(false)
    mocks.useAuth.mockReturnValue({ status, isAuthenticated, login, hasRole })
  })

  it('attend la fin de l’initialisation avant la navigation protégée', async () => {
    status.value = 'initializing'
    const router = makeRouter()
    const navigation = router.push('/private')
    setTimeout(() => { status.value = 'unauthenticated' }, 0)

    await navigation

    expect(login).toHaveBeenCalledWith({ returnTo: '/private' })
  })

  it('exclut les routes callback du contrôle d’authentification', async () => {
    const router = makeRouter()

    await router.push('/callback')

    expect(login).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/callback')
  })

  it('restaure returnTo après un callback authentifié', async () => {
    isAuthenticated.value = true
    status.value = 'authenticated'
    mocks.consumeAuthReturnTo.mockReturnValue('/private?tab=details#claims')
    const router = makeRouter()

    await router.push('/callback')

    expect(router.currentRoute.value.fullPath).toBe('/private?tab=details#claims')
  })

  it('redirige une navigation non authentifiée une seule fois vers login', async () => {
    const router = makeRouter()

    await router.push('/private')

    expect(login).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('redirige vers forbiddenRoute quand un rôle manque', async () => {
    isAuthenticated.value = true
    status.value = 'authenticated'
    const router = makeRouter({ forbiddenRoute: '/forbidden' })

    await router.push('/admin')

    expect(router.currentRoute.value.path).toBe('/forbidden')
  })

  it('annule et émet ACCESS_DENIED sans forbiddenRoute', async () => {
    isAuthenticated.value = true
    status.value = 'authenticated'
    const router = makeRouter()

    await router.push('/admin')

    expect(mocks.reportAuthError).toHaveBeenCalledWith(expect.objectContaining({ code: 'ACCESS_DENIED' }))
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('ne relance pas login après une erreur de callback', async () => {
    status.value = 'error'
    const router = makeRouter()

    await router.push('/private')

    expect(login).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('n’effectue pas de redirection automatique après un échec de restauration silencieuse', async () => {
    mocks.shouldSuppressAutomaticLogin.mockReturnValue(true)
    const router = makeRouter()

    await router.push('/private')

    expect(login).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/')
  })
})
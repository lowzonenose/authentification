import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { AuthError } from '../src/core/errors.js'
import type { AuthClientEvents, AuthSession } from '../src/core/auth-client.js'

const mocks = vi.hoisted(() => ({
  events: undefined as unknown,
  client: {
    init: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    getAccessToken: vi.fn(),
    refreshAccessToken: vi.fn(),
    dispose: vi.fn(),
  },
}))

vi.mock('../src/adapters/oidc-client-ts.js', () => ({
  createOidcClientTsClient: (_options: unknown, events: unknown) => {
    mocks.events = events
    return mocks.client
  },
}))

import { createAuth, resetAuth, useAuth } from '../src/core/auth.js'

const options = {
  authority: 'https://iam.example.org',
  clientId: 'web-client',
  redirectUri: 'https://app.example.org/callback',
  silentRestore: false,
}

const session: AuthSession = {
  accessToken: 'test-access-token',
  expiresAt: 1_800_000_000,
  user: {
    sub: 'user-1',
    name: 'Test User',
    roles: ['reader'],
    claims: { sub: 'user-1' },
  },
}

function getClientEvents(): AuthClientEvents {
  return mocks.events as AuthClientEvents
}

afterEach(() => {
  resetAuth()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.events = undefined
  mocks.client.init.mockResolvedValue({ session: null })
  mocks.client.login.mockResolvedValue(undefined)
  mocks.client.logout.mockResolvedValue(undefined)
  mocks.client.getAccessToken.mockResolvedValue('test-access-token')
  mocks.client.refreshAccessToken.mockResolvedValue('refreshed-access-token')
})

describe('contrats du noyau useAuth', () => {
  it('partage la même instance entre setup et les appels hors composant', () => {
    let setupAuth: ReturnType<typeof useAuth> | undefined
    const app = createApp({
      setup() {
        setupAuth = useAuth()
        return () => null
      },
    })
    app.use(createAuth(options))
    app.mount(document.createElement('div'))

    expect(setupAuth).toBe(useAuth())
    app.unmount()
  })

  it('met à jour l’état avant de notifier les handlers login', () => {
    const app = createApp({ render: () => null })
    app.use(createAuth(options))
    const auth = useAuth()
    const observedStates: boolean[] = []
    auth.on('login', () => observedStates.push(auth.isAuthenticated.value))

    getClientEvents().onSessionChanged(session)

    expect(auth.status.value).toBe('authenticated')
    expect(auth.user.value?.sub).toBe('user-1')
    expect(observedStates).toEqual([true])
  })

  it('isole les exceptions de handlers et appelle les abonnés suivants', () => {
    const app = createApp({ render: () => null })
    app.use(createAuth(options))
    const auth = useAuth()
    const received: string[] = []
    auth.on('login', () => { throw new Error('handler failure') })
    auth.on('login', (user) => received.push(user.sub))

    expect(() => getClientEvents().onSessionChanged(session)).not.toThrow()
    expect(received).toEqual(['user-1'])
  })

  it('retourne une fonction de désabonnement effective', () => {
    const app = createApp({ render: () => null })
    app.use(createAuth(options))
    const handler = vi.fn()
    const unsubscribe = useAuth().on('login', handler)

    unsubscribe()
    getClientEvents().onSessionChanged(session)

    expect(handler).not.toHaveBeenCalled()
  })

  it('convertit les erreurs du client en erreurs typées pour getAccessToken', async () => {
    const app = createApp({ render: () => null })
    app.use(createAuth(options))
    mocks.client.getAccessToken.mockRejectedValue(new AuthError('TOKEN_EXPIRED', 'Aucun token valide'))

    await expect(useAuth().getAccessToken()).rejects.toMatchObject({
      name: 'AuthError',
      code: 'TOKEN_EXPIRED',
    })
  })

  it('termine la session et émet sessionExpired et error si getAccessToken échoue', async () => {
    const app = createApp({ render: () => null })
    app.use(createAuth(options))
    const auth = useAuth()
    const expiredHandler = vi.fn()
    const errorHandler = vi.fn()
    auth.on('sessionExpired', expiredHandler)
    auth.on('error', errorHandler)
    await Promise.resolve()
    getClientEvents().onSessionChanged(session)
    mocks.client.getAccessToken.mockRejectedValue(new AuthError('REFRESH_FAILED', 'Refresh failed'))

    await expect(auth.getAccessToken()).rejects.toMatchObject({ code: 'REFRESH_FAILED' })

    expect(auth.status.value).toBe('unauthenticated')
    expect(auth.isAuthenticated.value).toBe(false)
    expect(auth.user.value).toBeNull()
    expect(expiredHandler).toHaveBeenCalledOnce()
    expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({ code: 'REFRESH_FAILED' }))
  })

  it('conserve la session sur NETWORK_ERROR tout en notifiant error', async () => {
    const app = createApp({ render: () => null })
    app.use(createAuth(options))
    const auth = useAuth()
    const expiredHandler = vi.fn()
    const errorHandler = vi.fn()
    auth.on('sessionExpired', expiredHandler)
    auth.on('error', errorHandler)
    await Promise.resolve()
    getClientEvents().onSessionChanged(session)
    mocks.client.getAccessToken.mockRejectedValue(new AuthError('NETWORK_ERROR', 'Network unavailable'))

    await expect(auth.getAccessToken()).rejects.toMatchObject({ code: 'NETWORK_ERROR' })

    expect(auth.status.value).toBe('authenticated')
    expect(auth.isAuthenticated.value).toBe(true)
    expect(expiredHandler).not.toHaveBeenCalled()
    expect(errorHandler).toHaveBeenCalledOnce()
  })

  it('traite onError comme un abonné error unique à l’installation', () => {
    const onError = vi.fn()
    const app = createApp({ render: () => null })
    app.use(createAuth({ ...options, onError }))
    const authError = new AuthError('DISCOVERY_FAILED', 'Discovery failed')

    getClientEvents().onError(authError)

    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith(authError)
    expect(useAuth().status.value).toBe('unauthenticated')
    expect(useAuth().error.value).toBe(authError)
  })

  it('journalise en debug sans exposer tokens, claims ni détails d’erreur', async () => {
    const logger = vi.fn()
    const consoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    const app = createApp({ render: () => null })
    app.use(createAuth({ ...options, debug: true, logger }))
    await Promise.resolve()
    getClientEvents().onSessionChanged({
      ...session,
      accessToken: 'SENSITIVE_ACCESS_TOKEN',
      user: {
        ...session.user,
        email: 'private@example.test',
        claims: { access_token: 'SENSITIVE_CLAIM' },
      },
    })
    await useAuth().getAccessToken()
    getClientEvents().onError(new AuthError('REFRESH_FAILED', 'SENSITIVE_ERROR_MESSAGE', {
      cause: new Error('SENSITIVE_ERROR_CAUSE'),
    }))

    expect(logger).toHaveBeenCalled()
    expect(consoleDebug).toHaveBeenCalled()
    expect(logger.mock.calls.every(([, context]) => context?.level === 'debug')).toBe(true)
    const logOutput = JSON.stringify(logger.mock.calls)
    const consoleOutput = JSON.stringify(consoleDebug.mock.calls)
    expect(logOutput).not.toContain('SENSITIVE_ACCESS_TOKEN')
    expect(logOutput).not.toContain('SENSITIVE_CLAIM')
    expect(logOutput).not.toContain('private@example.test')
    expect(logOutput).not.toContain('SENSITIVE_ERROR_MESSAGE')
    expect(logOutput).not.toContain('SENSITIVE_ERROR_CAUSE')
    expect(consoleOutput).not.toContain('SENSITIVE_ACCESS_TOKEN')
    expect(consoleOutput).not.toContain('SENSITIVE_CLAIM')
    expect(consoleOutput).not.toContain('private@example.test')
    expect(consoleOutput).not.toContain('SENSITIVE_ERROR_MESSAGE')
    expect(consoleOutput).not.toContain('SENSITIVE_ERROR_CAUSE')
  })

  it('n’émet aucun log sans debug: true', async () => {
    const logger = vi.fn()
    const consoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    const app = createApp({ render: () => null })
    app.use(createAuth({ ...options, logger }))
    await Promise.resolve()
    getClientEvents().onSessionChanged(session)
    await useAuth().getAccessToken()

    expect(logger).not.toHaveBeenCalled()
    expect(consoleDebug).not.toHaveBeenCalled()
  })

  it('ignore les exceptions du logger sans interrompre les transitions de session', () => {
    const logger = vi.fn(() => { throw new Error('logger failure') })
    const app = createApp({ render: () => null })
    app.use(createAuth({ ...options, debug: true, logger }))

    expect(() => getClientEvents().onSessionChanged(session)).not.toThrow()
    expect(useAuth().isAuthenticated.value).toBe(true)
    expect(useAuth().user.value?.sub).toBe('user-1')
  })

  it('resetAuth libère le client et supprime les abonnements', () => {
    const app = createApp({ render: () => null })
    app.use(createAuth(options))
    const handler = vi.fn()
    useAuth().on('login', handler)

    resetAuth()

    expect(mocks.client.dispose).toHaveBeenCalledOnce()
    expect(() => useAuth()).toThrowError(expect.objectContaining({ code: 'NOT_INSTALLED' }))
    getClientEvents().onSessionChanged(session)
    expect(handler).not.toHaveBeenCalled()
  })

  it('signale l’expiration après avoir rendu la session non authentifiée', () => {
    const app = createApp({ render: () => null })
    app.use(createAuth(options))
    const auth = useAuth()
    const statesObserved: string[] = []
    getClientEvents().onSessionChanged(session)
    auth.on('sessionExpired', () => statesObserved.push(auth.status.value))

    getClientEvents().onSessionEnded('expired')

    expect(auth.isAuthenticated.value).toBe(false)
    expect(statesObserved).toEqual(['unauthenticated'])
  })
})
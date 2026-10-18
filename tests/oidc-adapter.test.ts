import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserManager } from 'oidc-client-ts'
import { createOidcUserStorage, createOidcClientTsClient } from '../src/adapters/oidc-client-ts.js'
import type { AuthClientEvents } from '../src/core/auth-client.js'
import type { ResolvedAuthOptions, StorageAdapter } from '../src/core/types.js'

const options: ResolvedAuthOptions = {
  authority: 'https://iam.example.org',
  clientId: 'web-client',
  redirectUri: 'https://app.example.org/callback',
  scope: 'openid',
  storage: 'memory',
  silentRestore: false,
  apiBaseUrls: [],
}

const events: AuthClientEvents = {
  onSessionChanged: vi.fn(),
  onSessionEnded: vi.fn(),
  onError: vi.fn(),
}

afterEach(() => vi.restoreAllMocks())

describe('adaptateur oidc-client-ts', () => {
  it('délègue les opérations du stockage personnalisé', () => {
    const adapter: StorageAdapter = {
      get: vi.fn(() => null),
      set: vi.fn(),
      remove: vi.fn(),
    }
    const store = createOidcUserStorage(adapter)

    store.setItem('token', 'value')
    expect(store.getItem('token')).toBeNull()
    expect(store.length).toBe(1)
    expect(store.key(0)).toBe('token')
    store.removeItem('token')

    expect(adapter.set).toHaveBeenCalledWith('token', 'value')
    expect(adapter.get).toHaveBeenCalledWith('token')
    expect(adapter.remove).toHaveBeenCalledWith('token')
    expect(store.length).toBe(0)
  })

  it('ne restaure aucune session si silentRestore est désactivé', async () => {
    const getUser = vi.spyOn(UserManager.prototype, 'getUser')
    const signinSilent = vi.spyOn(UserManager.prototype, 'signinSilent')
    const client = createOidcClientTsClient(options, events)

    await expect(client.init()).resolves.toEqual({ session: null })
    expect(getUser).not.toHaveBeenCalled()
    expect(signinSilent).not.toHaveBeenCalled()
    client.dispose()
  })

  it('délègue le callback iframe à signinCallback pour notifier la fenêtre parente', async () => {
    window.history.replaceState(null, '', '/?code=silent-code&state=silent-state')
    const signinCallback = vi.spyOn(UserManager.prototype, 'signinCallback').mockResolvedValue(undefined)
    const signinRedirectCallback = vi.spyOn(UserManager.prototype, 'signinRedirectCallback')
    const client = createOidcClientTsClient({ ...options, silentRestore: true }, events)

    await expect(client.init()).resolves.toEqual({ session: null })

    expect(signinCallback).toHaveBeenCalledWith('https://app.example.org/?code=silent-code&state=silent-state')
    expect(signinRedirectCallback).not.toHaveBeenCalled()
    expect(window.location.search).toBe('')
    client.dispose()
  })
})
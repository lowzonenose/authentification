import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import { AuthError } from '../src/core/errors'
import { createAuth, resetAuth, useAuth } from '../src/core/auth'

const options = {
  authority: 'https://iam.example.org',
  clientId: 'web-client',
  redirectUri: 'https://app.example.org/callback',
  silentRestore: false,
}

afterEach(() => resetAuth())

describe('createAuth et useAuth', () => {
  it('lève NOT_INSTALLED avant l’installation du plugin', () => {
    expect(() => useAuth()).toThrowError(expect.objectContaining({ code: 'NOT_INSTALLED' }))
  })

  it('retourne un plugin opaque et partage le même état', () => {
    const plugin = createAuth(options)
    expect(Object.keys(plugin)).toEqual(['install'])

    const app = createApp({ render: () => null })
    app.use(plugin)
    const first = useAuth()
    const second = useAuth()

    expect(first).toBe(second)
    expect(first.status.value).toBe('initializing')
  })

  it('refuse returnTo vers une autre origine avant la redirection', async () => {
    const app = createApp({ render: () => null })
    app.use(createAuth(options))

    await expect(useAuth().login({ returnTo: 'https://evil.example/path' })).rejects.toMatchObject({
      code: 'CONFIG_INVALID',
    } satisfies Partial<AuthError>)
  })

  it('resetAuth désinstalle le singleton', () => {
    const app = createApp({ render: () => null })
    app.use(createAuth(options))
    resetAuth()

    expect(() => useAuth()).toThrowError(expect.objectContaining({ code: 'NOT_INSTALLED' }))
  })
})
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  isConfiguredApiUrl: vi.fn(),
  refreshAccessTokenAfterUnauthorized: vi.fn(),
}))

vi.mock('../src/core/auth.js', () => mocks)

import { createAuthFetch } from '../src/http/auth-fetch.js'

describe('createAuthFetch', () => {
  const getAccessToken = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAuth.mockReturnValue({ getAccessToken })
    mocks.isConfiguredApiUrl.mockImplementation((url: string) => url.startsWith('https://api.example.org/'))
    getAccessToken.mockResolvedValue('initial-token')
    mocks.refreshAccessTokenAfterUnauthorized.mockResolvedValue('refreshed-token')
  })

  it('n’ajoute jamais de token à une URL non déclarée', async () => {
    const baseFetch = vi.fn(async (input: RequestInfo | URL) => {
      void input
      return new Response('ok')
    })
    const authFetch = createAuthFetch(baseFetch)

    await authFetch('https://cdn.example.net/library.js')

    expect(baseFetch).toHaveBeenCalledOnce()
    const sentRequest = baseFetch.mock.calls[0]?.[0]
    expect(sentRequest).toBeInstanceOf(Request)
    expect(sentRequest instanceof Request ? sentRequest.headers.get('Authorization') : null).toBeNull()
    expect(getAccessToken).not.toHaveBeenCalled()
  })

  it('joint le token déclaré puis renouvelle une fois et rejoue une fois sur 401', async () => {
    const baseFetch = vi.fn()
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    const authFetch = createAuthFetch(baseFetch)

    const response = await authFetch('https://api.example.org/v1/users')

    expect(response.status).toBe(200)
    expect(baseFetch).toHaveBeenCalledTimes(2)
    expect((baseFetch.mock.calls[0]?.[0] as Request).headers.get('Authorization')).toBe('Bearer initial-token')
    expect((baseFetch.mock.calls[1]?.[0] as Request).headers.get('Authorization')).toBe('Bearer refreshed-token')
    expect(mocks.refreshAccessTokenAfterUnauthorized).toHaveBeenCalledOnce()
  })

  it('ne renouvelle pas deux fois si la nouvelle tentative retourne encore 401', async () => {
    const baseFetch = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }))
    const authFetch = createAuthFetch(baseFetch)

    const response = await authFetch('https://api.example.org/v1/users')

    expect(response.status).toBe(401)
    expect(baseFetch).toHaveBeenCalledTimes(2)
    expect(mocks.refreshAccessTokenAfterUnauthorized).toHaveBeenCalledOnce()
  })
})
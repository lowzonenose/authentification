// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createServer, type ServerResponse } from 'node:http'
import { createHash, generateKeyPairSync, sign, webcrypto } from 'node:crypto'
import { JSDOM } from 'jsdom'
import { createOidcClientTsClient } from '../src/adapters/oidc-client-ts.js'
import type { AuthClient, AuthClientEvents } from '../src/core/auth-client.js'
import type { ResolvedAuthOptions } from '../src/core/types.js'

const clientId = 'integration-client'
const keyId = 'test-signing-key'
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const publicJwk = { ...publicKey.export({ format: 'jwk' }), kid: keyId, use: 'sig', alg: 'RS256' }
const server = createServer()
const tokenRequests: URLSearchParams[] = []
let baseUrl = ''
let issuer = ''
let authorizationRequest: URL | undefined
let endSessionUrl: URL | undefined
let idTokenNonceOverride: string | undefined
let dom: JSDOM | undefined

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(value))
}

function makeIdToken(nonce: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyId })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: issuer,
    sub: 'integration-user',
    aud: clientId,
    exp: now + 3600,
    iat: now,
    nonce,
    name: 'Integration User',
    email: 'integration@example.test',
  })).toString('base64url')
  const input = `${header}.${payload}`
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`
}

server.on('request', (request, response) => {
  const url = new URL(request.url ?? '/', baseUrl)
  if (request.method === 'GET' && url.pathname === '/realms/test/.well-known/openid-configuration') {
    json(response, 200, {
      issuer,
      authorization_endpoint: `${baseUrl}/protocol/openid-connect/auth`,
      token_endpoint: `${baseUrl}/protocol/openid-connect/token`,
      jwks_uri: `${baseUrl}/protocol/openid-connect/certs`,
      userinfo_endpoint: `${baseUrl}/protocol/openid-connect/userinfo`,
      end_session_endpoint: `${baseUrl}/protocol/openid-connect/logout`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
      response_modes_supported: ['query'],
    })
    return
  }

  if (request.method === 'GET' && url.pathname === '/protocol/openid-connect/certs') {
    json(response, 200, { keys: [publicJwk] })
    return
  }

  if (request.method === 'GET' && url.pathname === '/protocol/openid-connect/auth') {
    authorizationRequest = url
    response.writeHead(200, { 'content-type': 'text/html' })
    response.end('<html><body>authorization request received</body></html>')
    return
  }

  if (request.method === 'POST' && url.pathname === '/protocol/openid-connect/token') {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => { body += chunk })
    request.on('end', () => {
      const form = new URLSearchParams(body)
      tokenRequests.push(form)
      if (form.get('grant_type') === 'authorization_code') {
        const verifier = form.get('code_verifier') ?? ''
        const challenge = createHash('sha256').update(verifier).digest('base64url')
        if (form.get('code') !== 'mock-code' || challenge !== authorizationRequest?.searchParams.get('code_challenge')) {
          json(response, 400, { error: 'invalid_grant' })
          return
        }
        json(response, 200, {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
          id_token: makeIdToken(idTokenNonceOverride ?? authorizationRequest?.searchParams.get('nonce') ?? ''),
          scope: 'openid profile email offline_access',
        })
        return
      }
      if (form.get('grant_type') === 'refresh_token' && form.get('refresh_token') === 'mock-refresh-token') {
        json(response, 200, {
          access_token: 'refreshed-access-token',
          refresh_token: 'rotated-refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid profile email offline_access',
        })
        return
      }
      json(response, 400, { error: 'unsupported_grant_type' })
    })
    return
  }

  if (request.method === 'GET' && url.pathname === '/protocol/openid-connect/logout') {
    endSessionUrl = url
    response.writeHead(200, { 'content-type': 'text/html' })
    response.end('<html><body>logged out</body></html>')
    return
  }

  if (request.method === 'GET' && url.pathname === '/protocol/openid-connect/userinfo') {
    json(response, 200, { sub: 'integration-user', name: 'Integration User' })
    return
  }

  json(response, 404, { error: 'not_found' })
})

beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Local mock IdP did not bind a TCP port')
  baseUrl = `http://127.0.0.1:${address.port}`
  issuer = `${baseUrl}/realms/test`
  dom = new JSDOM('', { url: `${baseUrl}/` })
  vi.stubGlobal('window', dom.window)
  vi.stubGlobal('document', dom.window.document)
  vi.stubGlobal('XMLHttpRequest', dom.window.XMLHttpRequest)
  vi.stubGlobal('crypto', webcrypto)
})

afterAll(async () => {
  dom?.window.close()
  vi.unstubAllGlobals()
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

describe('flux OIDC avec un IdP HTTP mocké', () => {
  it('exécute authorization code + PKCE, callback, refresh-token et logout', async () => {
    const options: ResolvedAuthOptions = {
      authority: issuer,
      clientId,
      redirectUri: `${baseUrl}/callback`,
      postLogoutRedirectUri: `${baseUrl}/signed-out`,
      scope: 'openid profile email offline_access',
      storage: 'memory',
      silentRestore: false,
      apiBaseUrls: [],
    }
    const events: AuthClientEvents = {
      onSessionChanged: vi.fn(),
      onSessionEnded: vi.fn(),
      onError: vi.fn(),
    }
    const redirectNavigator = {
      async prepare() {
        return {
          async navigate({ url }: { url: string }) {
            const target = new URL(url)
            if (target.pathname.endsWith('/logout')) endSessionUrl = target
            await fetch(target)
            return { url }
          },
          close() {},
        }
      },
      async callback() {},
    }
    const client: AuthClient = createOidcClientTsClient(options, events, { redirectNavigator })

    try {
      await client.login({ returnTo: '/private?tab=maps' })
      expect(authorizationRequest?.origin).toBe(baseUrl)
      expect(authorizationRequest?.searchParams.get('response_type')).toBe('code')
      expect(authorizationRequest?.searchParams.get('code_challenge_method')).toBe('S256')
      expect(authorizationRequest?.searchParams.get('code_challenge')).toBeTruthy()
      expect(authorizationRequest?.searchParams.get('nonce')).toBeTruthy()

      const state = authorizationRequest?.searchParams.get('state')
      window.history.replaceState(null, '', `/callback?code=mock-code&state=${encodeURIComponent(state ?? '')}`)
      const result = await client.init()

      expect(result.session?.user).toMatchObject({
        sub: 'integration-user',
        name: 'Integration User',
        email: 'integration@example.test',
      })
      expect(result.returnTo).toBe('/private?tab=maps')
      expect(window.location.search).toBe('')
      expect(events.onSessionChanged).toHaveBeenCalledOnce()
      expect(tokenRequests[0]?.get('code_verifier')).toBeTruthy()

      await expect(client.getAccessToken()).resolves.toBe('mock-access-token')
      await expect(client.refreshAccessToken()).resolves.toBe('refreshed-access-token')
      expect(tokenRequests.at(-1)?.get('grant_type')).toBe('refresh_token')
      expect(tokenRequests.at(-1)?.get('refresh_token')).toBe('mock-refresh-token')
      await expect(client.refreshAccessToken()).rejects.toMatchObject({ code: 'REFRESH_FAILED' })
      expect(tokenRequests.at(-1)?.get('refresh_token')).toBe('rotated-refresh-token')

      await client.logout()
      expect(endSessionUrl?.pathname).toBe('/protocol/openid-connect/logout')
      expect(endSessionUrl?.searchParams.get('post_logout_redirect_uri')).toBe(options.postLogoutRedirectUri)
      expect(events.onSessionEnded).toHaveBeenCalledWith('logout')
    } finally {
      client.dispose()
    }
  })

  it('rejette un callback avec un state absent du stockage local', async () => {
    const options: ResolvedAuthOptions = {
      authority: issuer,
      clientId,
      redirectUri: `${baseUrl}/callback`,
      scope: 'openid profile email',
      storage: 'memory',
      silentRestore: false,
      apiBaseUrls: [],
    }
    const redirectNavigator = {
      async prepare() {
        return {
          async navigate({ url }: { url: string }) { return { url } },
          close() {},
        }
      },
      async callback() {},
    }
    const client: AuthClient = createOidcClientTsClient(options, {
      onSessionChanged: vi.fn(),
      onSessionEnded: vi.fn(),
      onError: vi.fn(),
    }, { redirectNavigator })

    try {
      await client.login()
      window.history.replaceState(null, '', '/callback?code=mock-code&state=unknown-state')
      await expect(client.init()).rejects.toMatchObject({ code: 'STATE_MISMATCH' })
    } finally {
      client.dispose()
    }
  })

  it('rejette un ID token signé dont le nonce ne correspond pas à la requête', async () => {
    const options: ResolvedAuthOptions = {
      authority: issuer,
      clientId,
      redirectUri: `${baseUrl}/callback`,
      scope: 'openid profile email',
      storage: 'memory',
      silentRestore: false,
      apiBaseUrls: [],
    }
    const redirectNavigator = {
      async prepare() {
        return {
          async navigate({ url }: { url: string }) {
            authorizationRequest = new URL(url)
            return { url }
          },
          close() {},
        }
      },
      async callback() {},
    }
    const client: AuthClient = createOidcClientTsClient(options, {
      onSessionChanged: vi.fn(),
      onSessionEnded: vi.fn(),
      onError: vi.fn(),
    }, { redirectNavigator })

    try {
      await client.login()
      const state = authorizationRequest?.searchParams.get('state')
      idTokenNonceOverride = 'wrong-nonce'
      window.history.replaceState(null, '', `/callback?code=mock-code&state=${encodeURIComponent(state ?? '')}`)
      await expect(client.init()).rejects.toMatchObject({ code: 'NONCE_MISMATCH' })
    } finally {
      idTokenNonceOverride = undefined
      client.dispose()
    }
  })
})

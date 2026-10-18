import { describe, expect, it } from 'vitest'
import { authOptionsFromEnv, resolveAuthOptions } from '../src/core/config'

describe('authOptionsFromEnv', () => {
  it('construit authority depuis IAM_URL et IAM_REALM', () => {
    expect(authOptionsFromEnv({
      IAM_URL: 'https://iam.example.org/',
      IAM_REALM: 'demo',
      IAM_CLIENT_ID: 'web-client',
      IAM_REDIRECT_URI: 'https://app.example.org/callback',
    })).toMatchObject({
      authority: 'https://iam.example.org/realms/demo',
      clientId: 'web-client',
      redirectUri: 'https://app.example.org/callback',
    })
  })

  it('priorise IAM_AUTHORITY sur IAM_URL et IAM_REALM', () => {
    expect(authOptionsFromEnv({
      IAM_AUTHORITY: 'https://issuer.example.org',
      IAM_URL: 'https://ignored.example.org',
      IAM_REALM: 'ignored',
    })).toMatchObject({ authority: 'https://issuer.example.org' })
  })

  it('active debug uniquement si IAM_DEBUG vaut true', () => {
    expect(authOptionsFromEnv({ IAM_DEBUG: 'true' })).toEqual({ debug: true })
    expect(authOptionsFromEnv({ IAM_DEBUG: 'false' })).toEqual({ debug: false })
    expect(authOptionsFromEnv({})).not.toHaveProperty('debug')
  })

  it('refuse les variables contenant un secret', () => {
    expect(() => authOptionsFromEnv({ IAM_CLIENT_SECRET: 'must-not-leak' })).toThrowError(
      expect.objectContaining({ code: 'CONFIG_INVALID' }),
    )
  })

  it('refuse toute variable IAM contenant un secret', () => {
    expect(() => authOptionsFromEnv({ IAM_OTHER_SECRET: 'must-not-leak' })).toThrowError(
      expect.objectContaining({ code: 'CONFIG_INVALID' }),
    )
  })
})

describe('resolveAuthOptions', () => {
  const base = {
    authority: 'https://iam.example.org',
    clientId: 'web-client',
    redirectUri: 'https://app.example.org/callback',
  }

  it('applique les valeurs par défaut', () => {
    expect(resolveAuthOptions(base)).toMatchObject({
      scope: 'openid',
      storage: 'memory',
      silentRestore: true,
      apiBaseUrls: [],
    })
  })

  it('rejette une URL non HTTPS hors localhost', () => {
    expect(() => resolveAuthOptions({ ...base, authority: 'http://iam.example.org' })).toThrowError(
      /IAM_AUTHORITY doit utiliser HTTPS/,
    )
  })

  it('nomme les variables obligatoires manquantes', () => {
    expect(() => resolveAuthOptions({})).toThrowError(/IAM_AUTHORITY/)
  })

  it('refuse une URI de callback d’une autre origine', () => {
    expect(() => resolveAuthOptions({ ...base, redirectUri: 'https://elsewhere.example.org/callback' }))
      .toThrowError(/IAM_REDIRECT_URI doit rester sur la même origine/)
  })
})
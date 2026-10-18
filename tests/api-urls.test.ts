import { describe, expect, it } from 'vitest'
import { createApiUrlMatcher } from '../src/core/api-urls.js'

describe('createApiUrlMatcher', () => {
  const isApiUrl = createApiUrlMatcher(['https://api.example.org/v1/'])

  it('autorise le préfixe sur une frontière de segment', () => {
    expect(isApiUrl('https://api.example.org/v1')).toBe(true)
    expect(isApiUrl('https://api.example.org/v1/users')).toBe(true)
    expect(isApiUrl('https://api.example.org/v10/users')).toBe(false)
  })

  it('compare exactement l’origine et normalise les segments relatifs', () => {
    expect(isApiUrl('https://api.example.org.evil.com/v1/users')).toBe(false)
    expect(isApiUrl('https://api.example.org@evil.com/v1/users')).toBe(false)
    expect(isApiUrl('http://api.example.org/v1/users')).toBe(false)
    expect(isApiUrl('https://api.example.org:8443/v1/users')).toBe(false)
    expect(isApiUrl('https://api.example.org/v1/../admin')).toBe(false)
    expect(isApiUrl('/v1/users', 'https://app.example.org/')).toBe(false)
  })

  it('rejette les bases non sécurisées ou contenant des jokers', () => {
    expect(() => createApiUrlMatcher(['http://api.example.org/'])).toThrowError(/apiBaseUrls/)
    expect(() => createApiUrlMatcher(['https://*.example.org/'])).toThrowError(/apiBaseUrls/)
    expect(() => createApiUrlMatcher(['https://user:pass@api.example.org/'])).toThrowError(/apiBaseUrls/)
    expect(() => createApiUrlMatcher(['https://api.example.org/?token=value'])).toThrowError(/apiBaseUrls/)
  })

  it('n’autorise rien avec une liste vide', () => {
    expect(createApiUrlMatcher([])('https://api.example.org/v1/users')).toBe(false)
  })
})
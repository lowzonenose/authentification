import { useAuth, isConfiguredApiUrl, refreshAccessTokenAfterUnauthorized } from '../core/auth.js'

export function createAuthFetch(baseFetch = fetch) {
  return async (input, init) => {
    const request = new Request(input, init)
    if (!isConfiguredApiUrl(request.url)) return baseFetch(request)
    const retryTemplate = request.clone()
    const headers = new Headers(request.headers)
    headers.set('Authorization', `Bearer ${await useAuth().getAccessToken()}`)
    const response = await baseFetch(new Request(request, { headers }))
    if (response.status !== 401) return response
    const refreshedToken = await refreshAccessTokenAfterUnauthorized()
    const retryHeaders = new Headers(retryTemplate.headers)
    retryHeaders.set('Authorization', `Bearer ${refreshedToken}`)
    return baseFetch(new Request(retryTemplate, { headers: retryHeaders }))
  }
}
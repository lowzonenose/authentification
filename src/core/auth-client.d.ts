import type { AuthError } from './errors.js'
import type { AuthUser, ResolvedAuthOptions } from './types.js'

export interface AuthSession {
  accessToken: string
  expiresAt: number
  idToken?: string
  user: AuthUser
}

export interface AuthClientEvents {
  onSessionChanged(session: AuthSession): void
  onSessionEnded(reason: 'logout' | 'expired' | 'refresh_failed'): void
  onError(error: AuthError): void
}

export interface AuthClient {
  init(): Promise<{ session: AuthSession | null; returnTo?: string }>
  login(options?: { returnTo?: string; prompt?: string; loginHint?: string }): Promise<void>
  logout(options?: { returnTo?: string }): Promise<void>
  getAccessToken(): Promise<string>
  refreshAccessToken(): Promise<string>
  dispose(): void
}

export type AuthClientFactory = (options: ResolvedAuthOptions, events: AuthClientEvents) => AuthClient
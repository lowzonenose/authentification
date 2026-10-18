export type {
  AuthErrorCode,
  AuthEventMap,
  AuthEventName,
  AuthOptions,
  AuthOptionsInput,
  AuthStatus,
  AuthUser,
  Logger,
  StorageAdapter,
  UseAuth,
} from '../../types/index.js'

import type { AuthOptions, AuthError } from '../../types/index.js'

export interface ResolvedAuthOptions extends AuthOptions {
  authority: string
  clientId: string
  redirectUri: string
  scope: string
  storage: 'memory' | 'session' | NonNullable<AuthOptions['storage']>
  silentRestore: boolean
  apiBaseUrls: string[]
  onError?: (error: AuthError) => void
}
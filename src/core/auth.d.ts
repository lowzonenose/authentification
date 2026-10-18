export {
  createAuth,
  resetAuth,
  useAuth,
} from '../../types/index.js'

export function isConfiguredApiUrl(input: string | URL, relativeTo?: string): boolean
export function refreshAccessTokenAfterUnauthorized(): Promise<string>
export function consumeAuthReturnTo(): string | undefined
export function reportAuthError(error: import('../../types/index.js').AuthError): void
export function shouldSuppressAutomaticLogin(): boolean
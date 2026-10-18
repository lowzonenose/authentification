export class AuthError extends Error {
  constructor(code, message, options = {}) {
    super(message, options)
    this.name = 'AuthError'
    this.code = code
  }
}
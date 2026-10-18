import { createLogger } from 'vue-logger-plugin'
import { AuthError } from './errors.js'

const SAFE_LOG_FIELDS = new Set(['event', 'status', 'code', 'returnToProvided', 'promptProvided', 'durationMs'])

export class Logger {
  constructor(sink, enabled = false) {
    this.sink = sink
    this.enabled = enabled
    this.plugin = createLogger({
      enabled,
      consoleEnabled: enabled,
      level: 'debug',
      callerInfo: false,
      afterHooks: [{
        run: ({ argumentArray }) => {
          try {
            this.sink?.(argumentArray[0], argumentArray[1])
          } catch {
            // Un sink applicatif ne doit pas interrompre le flux d’authentification.
          }
        },
      }],
    })
  }

  install(app) {
    app.use(this.plugin)
  }

  debug(message, details = {}) {
    if (!this.enabled) return
    const safeDetails = Object.fromEntries(Object.entries(details).filter(([key, value]) =>
      SAFE_LOG_FIELDS.has(key) && (typeof value === 'string' || typeof value === 'boolean' ||
        (key === 'durationMs' && Number.isFinite(value))),
    ))
    try {
      this.plugin.debug(`[auth] ${message}`, { level: 'debug', ...safeDetails })
    } catch {
      // Le logger ne doit jamais modifier le résultat de l’opération observée.
    }
  }

  start(action, details = {}) {
    const startedAt = performance.now()
    this.debug(`${action} started`, details)
    return (outcome, extra = {}) => this.debug(`${action} ${outcome}`, {
      ...details, ...extra, durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
    })
  }

  async measure(action, operation, details = {}) {
    const end = this.start(action, details)
    try {
      const result = await operation()
      end('completed')
      return result
    } catch (error) {
      end('failed', { code: error instanceof AuthError ? error.code : undefined })
      throw error
    }
  }
}
import type { CollectionSlug, Config, PayloadRequest } from 'payload'

/**
 * A named health check. Resolve (return anything) to report `ok`; throw to
 * report `error` and turn the whole response into a 503. May be async — the
 * result is awaited either way, and `unknown` already covers a promise.
 */
export type HealthCheck = (req: PayloadRequest) => unknown

export type HealthCheckResult = {
  /** The thrown error's message, only present when `status` is `'error'`. */
  error?: string
  status: 'error' | 'ok'
}

export type HealthResponse = {
  /** Per-check results, only present when `checks` are configured. */
  checks?: Record<string, HealthCheckResult>
  status: 'error' | 'ok'
  /** ISO 8601 timestamp of when the checks ran. */
  timestamp: string
}

export type ComposiusPayloadPluginHealthConfig = {
  /**
   * Named checks run on every request. Each receives the `PayloadRequest`
   * (use `req.payload` to reach the Local API, e.g. a database probe).
   * A check that throws marks the response `error` with HTTP status 503;
   * the thrown message is reported per check.
   */
  checks?: Record<string, HealthCheck>
  /**
   * Adds the built-in `database` check, which counts documents in the admin
   * user collection to probe the database connection. Set to `false` to drop
   * it; a `database` entry in `checks` takes precedence over it.
   * @default true
   */
  database?: boolean
  disabled?: boolean
  /**
   * Path of the health endpoint, mounted on the Payload API route
   * (`/api${path}` with the default Payload config).
   * @default '/health'
   */
  path?: string
}

/**
 * Probes the database through the admin user collection, which always exists,
 * whatever its slug. Added as the `database` check unless the `database`
 * option is `false`.
 */
export const databaseHealthCheck: HealthCheck = async (req) => {
  await req.payload.count({
    collection: req.payload.config.admin.user as CollectionSlug,
  })
}

/**
 * Adds an unauthenticated GET endpoint (default `/api/health`) returning
 * `200 { status: 'ok' }` when the process — and every configured check —
 * is healthy, and `503 { status: 'error' }` otherwise.
 */
export const ComposiusPayloadPluginHealth =
  (pluginOptions: ComposiusPayloadPluginHealthConfig = {}) =>
  (config: Config): Config => {
    // The plugin adds no collections or fields, so the database schema is
    // unaffected and disabling can skip the endpoint entirely.
    if (pluginOptions.disabled) {
      return config
    }

    // An explicit `checks.database` wins over the built-in one.
    const checks: Record<string, HealthCheck> = {
      ...(pluginOptions.database === false ? {} : { database: databaseHealthCheck }),
      ...pluginOptions.checks,
    }

    config.endpoints = [
      ...(config.endpoints ?? []),
      {
        handler: async (req) => {
          const results: Record<string, HealthCheckResult> = {}

          await Promise.all(
            Object.entries(checks).map(async ([name, check]) => {
              try {
                await check(req)
                results[name] = { status: 'ok' }
              } catch (error) {
                results[name] = {
                  error: error instanceof Error ? error.message : String(error),
                  status: 'error',
                }
              }
            }),
          )

          const healthy = Object.values(results).every((result) => result.status === 'ok')

          const body: HealthResponse = {
            status: healthy ? 'ok' : 'error',
            timestamp: new Date().toISOString(),
            ...(Object.keys(checks).length ? { checks: results } : {}),
          }

          return Response.json(body, {
            headers: { 'Cache-Control': 'no-store' },
            status: healthy ? 200 : 503,
          })
        },
        method: 'get',
        path: pluginOptions.path ?? '/health',
      },
    ]

    return config
  }

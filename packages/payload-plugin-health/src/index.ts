import type { Config, PayloadRequest } from 'payload'

/**
 * A named health check. Resolve (return anything) to report `ok`; throw to
 * report `error` and turn the whole response into a 503.
 */
export type HealthCheck = (req: PayloadRequest) => Promise<unknown> | unknown

export type HealthCheckResult = {
  status: 'error' | 'ok'
  /** The thrown error's message, only present when `status` is `'error'`. */
  error?: string
}

export type HealthResponse = {
  status: 'error' | 'ok'
  /** ISO 8601 timestamp of when the checks ran. */
  timestamp: string
  /** Per-check results, only present when `checks` are configured. */
  checks?: Record<string, HealthCheckResult>
}

export type VWPayloadPluginHealthConfig = {
  /**
   * Path of the health endpoint, mounted on the Payload API route
   * (`/api${path}` with the default Payload config).
   * @default '/health'
   */
  path?: string
  /**
   * Named checks run on every request. Each receives the `PayloadRequest`
   * (use `req.payload` to reach the Local API, e.g. a database probe).
   * A check that throws marks the response `error` with HTTP status 503;
   * the thrown message is reported per check.
   */
  checks?: Record<string, HealthCheck>
  disabled?: boolean
}

/**
 * Adds an unauthenticated GET endpoint (default `/api/health`) returning
 * `200 { status: 'ok' }` when the process — and every configured check —
 * is healthy, and `503 { status: 'error' }` otherwise.
 */
export const VWPayloadPluginHealth =
  (pluginOptions: VWPayloadPluginHealthConfig = {}) =>
  (config: Config): Config => {
    // The plugin adds no collections or fields, so the database schema is
    // unaffected and disabling can skip the endpoint entirely.
    if (pluginOptions.disabled) {
      return config
    }

    const checks = pluginOptions.checks ?? {}

    config.endpoints = [
      ...(config.endpoints ?? []),
      {
        path: pluginOptions.path ?? '/health',
        method: 'get',
        handler: async (req) => {
          const results: Record<string, HealthCheckResult> = {}

          await Promise.all(
            Object.entries(checks).map(async ([name, check]) => {
              try {
                await check(req)
                results[name] = { status: 'ok' }
              } catch (error) {
                results[name] = {
                  status: 'error',
                  error: error instanceof Error ? error.message : String(error),
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
            status: healthy ? 200 : 503,
            headers: { 'Cache-Control': 'no-store' },
          })
        },
      },
    ]

    return config
  }

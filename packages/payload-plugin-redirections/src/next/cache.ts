import type { RedirectionRule, RedirectionRulesResponse } from '../types.js'

import {
  DEFAULT_PORT,
  DEFAULT_RETRY_TTL,
  DEFAULT_RULES_ENDPOINT,
  DEFAULT_STALE_TTL,
  DEFAULT_TIMEOUT,
  DEFAULT_TTL,
  RULES_VERSION,
  TOKEN_HEADER,
} from '../constants.js'

export type RedirectionRulesSource = {
  /**
   * Path of the rules endpoint, including the Payload API route. Change it when
   * the plugin runs under a custom `slug` or `endpoint.path`.
   * @default '/api/redirections/rules'
   */
  endpoint?: string
  /** Called on every fetch or parse failure. The request is served either way. */
  onError?: (error: unknown) => void
  /**
   * Base URL of the Payload app. Falls back to `NEXT_PUBLIC_PAYLOAD_URL`, then
   * `PAYLOAD_URL`, then `http://127.0.0.1:$PORT` — the loopback address of this
   * same process, which covers the common case of Payload living in the same
   * Next app. Set it when Payload is somewhere else, or when the proxy runs
   * away from the app (an edge runtime), where there is no shared loopback.
   */
  payloadURL?: string
  /**
   * Seconds a failed fetch is remembered before retrying, so a CMS that is down
   * does not cause a request storm.
   * @default 10
   */
  retryTtl?: number
  /**
   * Extra seconds a stale rule list keeps being served while refreshes fail.
   * @default 600
   */
  staleTtl?: number
  /**
   * Milliseconds before the rules fetch is aborted.
   * @default 2000
   */
  timeout?: number
  /** Matches the plugin's `endpoint.token`. Sent as `x-redirections-token`. */
  token?: string
  /**
   * Seconds the fetched rules stay fresh in module memory.
   * @default 60
   */
  ttl?: number
}

type CacheEntry = {
  expiresAt: number
  rules: RedirectionRule[]
  staleUntil: number
}

/**
 * Module-level, so the rule list is shared by every request served by this
 * isolate. It is per-isolate, never global: the TTL is a floor on how quickly a
 * change propagates, not a guarantee.
 */
let cache: CacheEntry | undefined

let inFlight: Promise<RedirectionRule[]> | undefined

const envURL = (): string | undefined => {
  const env = typeof process === 'undefined' ? undefined : process.env

  return env?.NEXT_PUBLIC_PAYLOAD_URL ?? env?.PAYLOAD_URL
}

/**
 * This process talking to itself. Deliberately not the origin of the incoming
 * request: behind a TLS-terminating proxy that public origin is `https://`, and
 * inside the network it resolves back to this same plain-HTTP listener, so the
 * handshake fails with `ERR_SSL_WRONG_VERSION_NUMBER`. Loopback skips the round
 * trip and the TLS entirely. `undefined` where there is no `process` to read a
 * port from, since such a runtime has no loopback to the app either.
 */
const loopbackURL = (): string | undefined => {
  if (typeof process === 'undefined') {
    return undefined
  }

  return `http://127.0.0.1:${process.env.PORT ?? DEFAULT_PORT}`
}

const rulesURL = (source: RedirectionRulesSource, origin: string): string => {
  const base = (source.payloadURL ?? envURL() ?? loopbackURL() ?? origin).replace(/\/$/, '')

  return `${base}${source.endpoint ?? DEFAULT_RULES_ENDPOINT}`
}

const fetchRules = async (
  source: RedirectionRulesSource,
  origin: string,
): Promise<RedirectionRule[]> => {
  const response = await fetch(rulesURL(source, origin), {
    // We do our own caching; the runtime's would fight the TTL below.
    cache: 'no-store',
    headers: source.token ? { [TOKEN_HEADER]: source.token } : undefined,
    signal: AbortSignal.timeout(source.timeout ?? DEFAULT_TIMEOUT),
  })

  if (!response.ok) {
    throw new Error(`Redirection rules request failed with ${response.status}`)
  }

  const body = (await response.json()) as null | RedirectionRulesResponse

  if (body?.version !== RULES_VERSION || !Array.isArray(body.rules)) {
    throw new Error(`Unexpected redirection rules payload (version ${String(body?.version)})`)
  }

  return body.rules
}

const refresh = (source: RedirectionRulesSource, origin: string): Promise<RedirectionRule[]> => {
  // Concurrent requests in this isolate share one fetch.
  if (inFlight) {
    return inFlight
  }

  const startedAt = Date.now()
  const retryTtl = (source.retryTtl ?? DEFAULT_RETRY_TTL) * 1000

  inFlight = fetchRules(source, origin)
    .then((rules) => {
      const ttl = (source.ttl ?? DEFAULT_TTL) * 1000
      cache = {
        expiresAt: startedAt + ttl,
        rules,
        staleUntil: startedAt + ttl + (source.staleTtl ?? DEFAULT_STALE_TTL) * 1000,
      }
      return rules
    })
    .catch((error: unknown) => {
      source.onError?.(error)

      // Fail open: keep serving the last known list while it is still within
      // staleUntil, otherwise behave as if there were no rules at all.
      if (cache && startedAt < cache.staleUntil) {
        cache = { ...cache, expiresAt: startedAt + retryTtl }
        return cache.rules
      }

      cache = { expiresAt: startedAt + retryTtl, rules: [], staleUntil: 0 }
      return []
    })
    .finally(() => {
      inFlight = undefined
    })

  return inFlight
}

/**
 * The cached rule list. A stale list is returned immediately while it refreshes
 * in the background, so only a cold start ever waits on the network.
 */
export const getRedirectionRules = async (
  source: RedirectionRulesSource = {},
  origin = '',
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<RedirectionRule[]> => {
  const now = Date.now()

  if (cache && now < cache.expiresAt) {
    return cache.rules
  }

  if (cache && now < cache.staleUntil) {
    const pending = refresh(source, origin)
    // Keeps the edge isolate alive long enough to finish the refresh.
    waitUntil?.(pending)
    return cache.rules
  }

  return refresh(source, origin)
}

/**
 * Drops the module cache, so the next lookup refetches. Useful from a
 * revalidation route handler after an editor saves, and in tests.
 */
export const clearRedirectionsCache = (): void => {
  cache = undefined
  inFlight = undefined
}

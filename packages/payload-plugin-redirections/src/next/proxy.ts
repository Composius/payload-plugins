import type { RedirectionRulesSource } from './cache.js'

import { SOURCE_HEADER } from '../constants.js'
import { isAbsoluteUrl } from '../lib/paths.js'
import { resolveRedirection } from '../lib/resolver.js'
import { getRedirectionRules } from './cache.js'

/**
 * The part of `NextRequest` this helper touches. Typed structurally so the
 * package needs no dependency on `next` — a real `NextRequest` satisfies it,
 * and so does a plain object in a test.
 */
export type RedirectionsProxyRequest = {
  method?: string
  nextUrl?: { origin: string; pathname: string; search: string }
  url: string
}

/** The part of `NextFetchEvent` this helper touches. */
export type RedirectionsProxyEvent = {
  waitUntil?: (promise: Promise<unknown>) => void
}

export type RedirectionsProxyOptions = RedirectionRulesSource & {
  /**
   * Sends an `x-redirection-source` header naming the rule that matched, which
   * turns "why did this redirect?" into a one-second answer.
   * @default true
   */
  debugHeader?: boolean
  /**
   * How many chained rules to collapse into a single response. `1` answers with
   * the first match; higher values follow `A → B → C`. Cycles always stop.
   * @default 1
   */
  maxHops?: number
  /** Skips the lookup for a request — health checks, previews, and the like. */
  skip?: (request: RedirectionsProxyRequest) => boolean
}

/**
 * Builds a Next.js proxy (Next 16's `proxy.ts`, or `middleware.ts` on Next 15)
 * that redirects according to the rules published by the plugin's endpoint.
 *
 * Returns a `Response` when a rule matches and `undefined` otherwise, so the
 * request continues — both are valid proxy return values. It never throws: if
 * the rules cannot be fetched, the request is served unchanged.
 *
 * ```ts
 * // proxy.ts
 * import { createRedirectionsProxy } from '@composius/payload-plugin-redirections/next'
 *
 * export default createRedirectionsProxy()
 *
 * export const config = {
 *   matcher: ['/((?!api|admin|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
 * }
 * ```
 */
export const createRedirectionsProxy =
  (options: RedirectionsProxyOptions = {}) =>
  async (
    request: RedirectionsProxyRequest,
    event?: RedirectionsProxyEvent,
  ): Promise<Response | undefined> => {
    // 301 and 302 rewrite the method, so only ever redirect safe requests.
    const method = (request.method ?? 'GET').toUpperCase()
    if (method !== 'GET' && method !== 'HEAD') {
      return undefined
    }

    if (options.skip?.(request)) {
      return undefined
    }

    const url = request.nextUrl ?? new URL(request.url)

    // Bound, because the cache calls this detached. A real `FetchEvent.waitUntil`
    // reads private state off `this` and throws
    // `Cannot read properties of undefined (reading 'Symbol(waitUntil)')` without
    // its receiver — and only ever on a stale-while-revalidate refresh, which is
    // why it surfaces intermittently rather than on the first request.
    const waitUntil = event?.waitUntil?.bind(event)

    const rules = await getRedirectionRules(options, url.origin, waitUntil)
    if (rules.length === 0) {
      return undefined
    }

    const resolved = resolveRedirection(url.pathname, rules, url.search, {
      maxHops: options.maxHops ?? 1,
      origin: url.origin,
    })

    if (!resolved) {
      return undefined
    }

    // A `Location` must be absolute for `NextResponse.redirect`, and browsers
    // are happier with it too — resolve root-relative destinations against the
    // incoming origin.
    const location = isAbsoluteUrl(resolved.to)
      ? resolved.to
      : new URL(resolved.to, url.origin).toString()

    const headers: Record<string, string> = { location }
    if (options.debugHeader !== false) {
      headers[SOURCE_HEADER] = resolved.rule.from
    }

    return new Response(null, { headers, status: resolved.status })
  }

// `next/server` is shadowed by an empty `next/server/` directory under this
// repo's `moduleResolution: nodenext`; real Next apps use `bundler`, where the
// public specifier resolves. This is the same declaration it re-exports.
import type { NextProxy } from 'next/dist/server/web/types.js'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { RedirectionRule } from '../src/types.js'

import { RULES_VERSION } from '../src/constants.js'
import { clearRedirectionsCache, getRedirectionRules } from '../src/next/cache.js'
import { createRedirectionsProxy } from '../src/next/proxy.js'

const rule = (
  overrides: Partial<RedirectionRule> & Pick<RedirectionRule, 'from' | 'to'>,
): RedirectionRule => ({
  matchType: 'exact',
  preserveQuery: true,
  status: 307,
  ...overrides,
})

const rules = [rule({ from: '/old', to: '/new' })]

const okResponse = (body: unknown = { count: 1, rules, updatedAt: null, version: RULES_VERSION }) =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })

const request = (url: string, method = 'GET') => {
  const parsed = new URL(url)

  return {
    method,
    nextUrl: { origin: parsed.origin, pathname: parsed.pathname, search: parsed.search },
    url,
  }
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  clearRedirectionsCache()
  fetchMock = vi.fn(async () => okResponse())
  vi.stubGlobal('fetch', fetchMock)
  // The base URL is read from the environment, so pin it rather than inherit
  // whatever the machine running the suite happens to export.
  vi.stubEnv('NEXT_PUBLIC_PAYLOAD_URL', undefined)
  vi.stubEnv('PAYLOAD_URL', undefined)
  vi.stubEnv('PORT', '4321')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the rules cache', () => {
  test('fetches once and serves the rest from memory', async () => {
    await getRedirectionRules({}, 'https://example.com')
    await getRedirectionRules({}, 'https://example.com')
    await getRedirectionRules({}, 'https://example.com')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('concurrent lookups share a single fetch', async () => {
    await Promise.all([
      getRedirectionRules({}, 'https://example.com'),
      getRedirectionRules({}, 'https://example.com'),
      getRedirectionRules({}, 'https://example.com'),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('defaults to this process on loopback and the documented endpoint path', async () => {
    vi.stubEnv('PORT', '4321')

    await getRedirectionRules({}, 'https://example.com')

    expect(fetchMock.mock.calls[0]![0]).toBe('http://127.0.0.1:4321/api/redirections/rules')
  })

  test('assumes Next’s default port when PORT is unset', async () => {
    vi.stubEnv('PORT', undefined)

    await getRedirectionRules({}, 'https://example.com')

    expect(fetchMock.mock.calls[0]![0]).toBe('http://127.0.0.1:3000/api/redirections/rules')
  })

  test('an env base URL wins over the loopback fallback', async () => {
    vi.stubEnv('PORT', '4321')
    vi.stubEnv('NEXT_PUBLIC_PAYLOAD_URL', 'https://cms.example.com')

    await getRedirectionRules({}, 'https://example.com')

    expect(fetchMock.mock.calls[0]![0]).toBe('https://cms.example.com/api/redirections/rules')
  })

  test('payloadURL and endpoint override the URL, trailing slash and all', async () => {
    await getRedirectionRules(
      { endpoint: '/api/url-rules/all', payloadURL: 'https://cms.example.com/' },
      'https://example.com',
    )

    expect(fetchMock.mock.calls[0]![0]).toBe('https://cms.example.com/api/url-rules/all')
  })

  test('sends the token header when configured', async () => {
    await getRedirectionRules({ token: 's3cret' }, 'https://example.com')

    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      headers: { 'x-redirections-token': 's3cret' },
    })
  })

  test('serves a stale list immediately and refreshes in the background', async () => {
    vi.useFakeTimers()

    await getRedirectionRules({ ttl: 60 }, 'https://example.com')
    vi.advanceTimersByTime(61_000)

    const waitUntil = vi.fn()
    const stale = await getRedirectionRules({ ttl: 60 }, 'https://example.com', waitUntil)

    // Returned without awaiting the refresh…
    expect(stale).toEqual(rules)
    expect(waitUntil).toHaveBeenCalledTimes(1)
    // …but the refresh was still kicked off.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('a cold failure fails open with an empty list and reports the error', async () => {
    const onError = vi.fn()
    fetchMock.mockRejectedValueOnce(new Error('offline'))

    expect(await getRedirectionRules({ onError }, 'https://example.com')).toEqual([])
    expect(onError).toHaveBeenCalledTimes(1)
  })

  test('a later failure keeps serving the last known list', async () => {
    vi.useFakeTimers()

    await getRedirectionRules({ ttl: 60 }, 'https://example.com')
    vi.advanceTimersByTime(61_000)
    fetchMock.mockRejectedValueOnce(new Error('offline'))

    // No waitUntil, so this awaits the failing refresh.
    expect(await getRedirectionRules({ ttl: 60 }, 'https://example.com')).toEqual(rules)
  })

  test('failures are negative-cached rather than retried on every request', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))

    await getRedirectionRules({ retryTtl: 10 }, 'https://example.com')
    await getRedirectionRules({ retryTtl: 10 }, 'https://example.com')
    await getRedirectionRules({ retryTtl: 10 }, 'https://example.com')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('a non-200 response fails open', async () => {
    const onError = vi.fn()
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }))

    expect(await getRedirectionRules({ onError }, 'https://example.com')).toEqual([])
    expect(onError).toHaveBeenCalledTimes(1)
  })

  test('an unknown payload version is refused', async () => {
    const onError = vi.fn()
    fetchMock.mockResolvedValueOnce(okResponse({ count: 1, rules, updatedAt: null, version: 99 }))

    expect(await getRedirectionRules({ onError }, 'https://example.com')).toEqual([])
    expect(onError).toHaveBeenCalledTimes(1)
  })

  test('malformed JSON is refused', async () => {
    const onError = vi.fn()
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }))

    expect(await getRedirectionRules({ onError }, 'https://example.com')).toEqual([])
    expect(onError).toHaveBeenCalledTimes(1)
  })
})

describe('createRedirectionsProxy', () => {
  test('redirects a matching request with an absolute location', async () => {
    const proxy = createRedirectionsProxy()
    const response = await proxy(request('https://example.com/old'))

    expect(response?.status).toBe(307)
    expect(response?.headers.get('location')).toBe('https://example.com/new')
    expect(response?.headers.get('x-redirection-source')).toBe('/old')
  })

  test('passes an absolute destination through untouched', async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        count: 1,
        rules: [rule({ from: '/old', to: 'https://other.example.com/new' })],
        updatedAt: null,
        version: RULES_VERSION,
      }),
    )

    const response = await createRedirectionsProxy()(request('https://example.com/old'))

    expect(response?.headers.get('location')).toBe('https://other.example.com/new')
  })

  test('forwards the query string', async () => {
    const response = await createRedirectionsProxy()(request('https://example.com/old?ref=x'))

    expect(response?.headers.get('location')).toBe('https://example.com/new?ref=x')
  })

  test('returns undefined when nothing matches', async () => {
    expect(await createRedirectionsProxy()(request('https://example.com/other'))).toBeUndefined()
  })

  test('never redirects an unsafe method, and does not even fetch', async () => {
    expect(
      await createRedirectionsProxy()(request('https://example.com/old', 'POST')),
    ).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('skip short-circuits before the lookup', async () => {
    const proxy = createRedirectionsProxy({ skip: () => true })

    expect(await proxy(request('https://example.com/old'))).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('debugHeader false omits the source header', async () => {
    const proxy = createRedirectionsProxy({ debugHeader: false })
    const response = await proxy(request('https://example.com/old'))

    expect(response?.headers.get('x-redirection-source')).toBeNull()
  })

  test('serves the request unchanged when the rules cannot be fetched', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))

    await expect(
      createRedirectionsProxy()(request('https://example.com/old')),
    ).resolves.toBeUndefined()
  })

  test('falls back to request.url when nextUrl is absent', async () => {
    const response = await createRedirectionsProxy()({
      method: 'GET',
      url: 'https://example.com/old',
    })

    expect(response?.headers.get('location')).toBe('https://example.com/new')
  })

  test('collapses a chain when maxHops allows it', async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        count: 2,
        rules: [rule({ from: '/old', to: '/mid' }), rule({ from: '/mid', to: '/new' })],
        updatedAt: null,
        version: RULES_VERSION,
      }),
    )

    const response = await createRedirectionsProxy({ maxHops: 3 })(request('https://example.com/old'))

    expect(response?.headers.get('location')).toBe('https://example.com/new')
  })

  test('passes waitUntil from the proxy event through to the cache', async () => {
    vi.useFakeTimers()

    const proxy = createRedirectionsProxy({ ttl: 60 })
    await proxy(request('https://example.com/old'))
    vi.advanceTimersByTime(61_000)

    const waitUntil = vi.fn()
    await proxy(request('https://example.com/old'), { waitUntil })

    expect(waitUntil).toHaveBeenCalledTimes(1)
  })

  test('waitUntil keeps its receiver, as a real FetchEvent method needs', async () => {
    vi.useFakeTimers()

    // Stands in for `FetchEvent.prototype.waitUntil`, which reads private state
    // off `this` and throws when called detached.
    const pending: Promise<unknown>[] = []
    const event = {
      waitUntil(this: { pending?: Promise<unknown>[] }, promise: Promise<unknown>) {
        this.pending!.push(promise)
      },
      pending,
    }

    const proxy = createRedirectionsProxy({ ttl: 60 })
    await proxy(request('https://example.com/old'), event)
    vi.advanceTimersByTime(61_000)

    await expect(proxy(request('https://example.com/old'), event)).resolves.toBeDefined()
    expect(pending).toHaveLength(1)
  })
})

describe('Next.js compatibility', () => {
  test('the proxy is assignable to NextProxy without importing next at runtime', () => {
    // Type-only: erased at build time, but it fails the typecheck if the
    // structural request/event shapes ever drift from Next's.
    const proxy: NextProxy = createRedirectionsProxy()

    expect(typeof proxy).toBe('function')
  })
})

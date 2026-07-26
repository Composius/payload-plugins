import type { Endpoint, Payload, PayloadRequest } from 'payload'

import { resolveRedirection } from '@composius/payload-plugin-redirections'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import config from './config.js'

let payload: Payload

afterAll(async () => {
  await payload.destroy()
})

beforeAll(async () => {
  payload = await getPayload({ config })
})

const rulesEndpoint = (): Endpoint => {
  const endpoint = payload.collections['redirections']?.config.endpoints
  const found = (endpoint === false ? [] : (endpoint ?? [])).find((entry) => entry.path === '/rules')
  expect(found).toBeDefined()
  return found!
}

const invokeRules = async (headers: Record<string, string> = {}) => {
  const req = { headers: new Headers(headers), payload } as unknown as PayloadRequest
  const response = (await rulesEndpoint().handler(req)) as Response

  return { body: response.status === 304 ? null : await response.json(), response }
}

const createRule = (data: Record<string, unknown>) =>
  payload.create({
    collection: 'redirections',
    // The dev suite generates types per plugin; this data is deliberately loose.
    data: data as never,
  })

const messageOf = (error: unknown): string =>
  error instanceof Error ? `${error.message} ${JSON.stringify(error)}` : String(error)

describe('Plugin integration tests', () => {
  test('plugin adds the redirections collection', () => {
    expect(payload.collections['redirections']).toBeDefined()
  })

  test('a new rule gets the documented defaults', async () => {
    const created = await createRule({ from: '/defaults', to: '/elsewhere' })

    expect(created).toMatchObject({
      enabled: true,
      matchType: 'exact',
      preserveQuery: true,
      priority: 0,
      status: '307',
    })
  })

  test('stores a rule of each match type', async () => {
    const prefix = await createRule({ from: '/docs', matchType: 'prefix', to: '/guides' })
    const regex = await createRule({
      from: '^/n/(\\d+)$',
      matchType: 'regex',
      status: '301',
      to: '/news/$1',
    })

    expect(prefix.matchType).toBe('prefix')
    expect(regex).toMatchObject({ matchType: 'regex', status: '301' })
  })

  test('rejects an invalid regular expression, naming the engine error', async () => {
    await expect(createRule({ from: '^/p/([', matchType: 'regex', to: '/x' })).rejects.toThrow()

    const error = await createRule({ from: '^/q/([', matchType: 'regex', to: '/x' }).catch(
      (caught: unknown) => caught,
    )
    expect(messageOf(error)).toMatch(/Invalid regular expression/i)
  })

  test('rejects a source without a leading slash', async () => {
    await expect(createRule({ from: 'no-slash', to: '/x' })).rejects.toThrow()
  })

  test('rejects a destination with an unsupported protocol', async () => {
    await expect(createRule({ from: '/ftp', to: 'ftp://example.com/x' })).rejects.toThrow()
  })

  test('rejects a rule that redirects to itself', async () => {
    await expect(createRule({ from: '/loop', to: '/loop' })).rejects.toThrow()
  })

  test('rejects a duplicate path and match type, but allows the same path under another', async () => {
    await createRule({ from: '/dupe', matchType: 'exact', to: '/a' })

    await expect(createRule({ from: '/dupe', matchType: 'exact', to: '/b' })).rejects.toThrow()
    await expect(
      createRule({ from: '/dupe', matchType: 'prefix', to: '/c' }),
    ).resolves.toBeDefined()
  })

  test('the rules endpoint publishes enabled rules only', async () => {
    const { body, response } = await invokeRules()

    expect(response.status).toBe(200)
    expect(body.version).toBe(1)
    expect(body.count).toBe(body.rules.length)

    const sources = body.rules.map((rule: { from: string }) => rule.from)
    expect(sources).toContain('/old-page')
    // Seeded with `enabled: false`.
    expect(sources).not.toContain('/parked')
  })

  test('the rules endpoint sends cache headers and honors If-None-Match', async () => {
    const { response } = await invokeRules()
    const etag = response.headers.get('etag')

    expect(response.headers.get('cache-control')).toBe(
      'public, s-maxage=60, stale-while-revalidate=600',
    )
    expect(etag).toBeTruthy()

    const cached = await invokeRules({ 'if-none-match': etag! })
    expect(cached.response.status).toBe(304)
  })

  test('the published rules feed the resolver directly', async () => {
    const { body } = await invokeRules()

    expect(resolveRedirection('/blog/hello', body.rules)).toMatchObject({
      status: 307,
      to: '/articles/hello',
    })
    expect(resolveRedirection('/old-page', body.rules)).toMatchObject({
      status: 301,
      to: '/new-page',
    })
    expect(resolveRedirection('/p/42', body.rules)?.to).toBe('/posts/42')
  })
})

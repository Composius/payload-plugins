import type { Config, Endpoint, PayloadRequest } from 'payload'

import { describe, expect, test } from 'vitest'

import type { HealthResponse } from '../src/index.js'

import { ComposiusPayloadPluginHealth } from '../src/index.js'

const baseConfig = (): Config => ({ collections: [] }) as unknown as Config

/** Enough of a `payload` to satisfy the built-in `database` check. */
const request = {
  payload: {
    config: { admin: { user: 'users' } },
    count: async () => ({ totalDocs: 0 }),
  },
} as unknown as PayloadRequest

const getEndpoint = (config: Config, path = '/health'): Endpoint => {
  const endpoint = config.endpoints?.find((entry) => entry.path === path)
  expect(endpoint).toBeDefined()
  return endpoint!
}

const invoke = async (config: Config, path = '/health') => {
  const response = (await getEndpoint(config, path).handler(request))
  return { body: (await response.json()) as HealthResponse, response }
}

describe('ComposiusPayloadPluginHealth', () => {
  test('adds a GET /health endpoint by default', () => {
    const config = ComposiusPayloadPluginHealth()(baseConfig())
    const endpoint = getEndpoint(config)

    expect(endpoint.method).toBe('get')
  })

  test('path option overrides the endpoint path', () => {
    const config = ComposiusPayloadPluginHealth({ path: '/status' })(baseConfig())

    expect(getEndpoint(config, '/status').method).toBe('get')
    expect(config.endpoints?.some((entry) => entry.path === '/health')).toBe(false)
  })

  test('preserves pre-existing endpoints', () => {
    const config = baseConfig()
    const existing: Endpoint = {
      handler: async () => Response.json({}),
      method: 'get',
      path: '/existing',
    }
    config.endpoints = [existing]

    const result = ComposiusPayloadPluginHealth()(config)

    expect(result.endpoints).toContain(existing)
    expect(result.endpoints).toHaveLength(2)
  })

  test('responds 200 ok without checks', async () => {
    const config = ComposiusPayloadPluginHealth({ database: false })(baseConfig())
    const { body, response } = await invoke(config)

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(body.status).toBe('ok')
    expect(Date.parse(body.timestamp)).not.toBeNaN()
    expect(body.checks).toBeUndefined()
  })

  test('responds 200 with per-check results when every check passes', async () => {
    const config = ComposiusPayloadPluginHealth({
      checks: {
        cache() {},
        async database() {},
      },
      database: false,
    })(baseConfig())
    const { body, response } = await invoke(config)

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.checks).toEqual({
      cache: { status: 'ok' },
      database: { status: 'ok' },
    })
  })

  test('runs the built-in database check by default', async () => {
    let counted: unknown
    const config = ComposiusPayloadPluginHealth()(baseConfig())
    const req = {
      payload: {
        config: { admin: { user: 'admins' } },
        count: async (args: unknown) => {
          counted = args
          return { totalDocs: 0 }
        },
      },
    } as unknown as PayloadRequest

    const response = (await getEndpoint(config).handler(req))
    const body = (await response.json()) as HealthResponse

    expect(response.status).toBe(200)
    expect(body.checks).toEqual({ database: { status: 'ok' } })
    expect(counted).toEqual({ collection: 'admins' })
  })

  test('responds 503 when the built-in database check fails', async () => {
    const config = ComposiusPayloadPluginHealth()(baseConfig())
    const req = {
      payload: {
        config: { admin: { user: 'users' } },
        count: async () => {
          throw new Error('connection refused')
        },
      },
    } as unknown as PayloadRequest

    const response = (await getEndpoint(config).handler(req))
    const body = (await response.json()) as HealthResponse

    expect(response.status).toBe(503)
    expect(body.checks?.database).toEqual({ error: 'connection refused', status: 'error' })
  })

  test('an explicit database check overrides the built-in one', async () => {
    let called = false
    const config = ComposiusPayloadPluginHealth({
      checks: {
        database() {
          called = true
        },
      },
    })(baseConfig())

    const { body } = await invoke(config)

    expect(called).toBe(true)
    expect(body.checks).toEqual({ database: { status: 'ok' } })
  })

  test('responds 503 with the failing check message when a check throws', async () => {
    const config = ComposiusPayloadPluginHealth({
      checks: {
        async cache() {
          throw new Error('connection refused')
        },
        database() {},
      },
    })(baseConfig())
    const { body, response } = await invoke(config)

    expect(response.status).toBe(503)
    expect(body.status).toBe('error')
    expect(body.checks).toEqual({
      cache: { error: 'connection refused', status: 'error' },
      database: { status: 'ok' },
    })
  })

  test('reports non-Error throws as strings', async () => {
    const config = ComposiusPayloadPluginHealth({
      checks: {
        cache() {
          // Throwing a non-Error is the case under test: the plugin has to
          // stringify whatever it catches.
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw 'boom'
        },
      },
    })(baseConfig())
    const { body, response } = await invoke(config)

    expect(response.status).toBe(503)
    expect(body.checks?.cache).toEqual({ error: 'boom', status: 'error' })
  })

  test('checks receive the request', async () => {
    let received: PayloadRequest | undefined
    const config = ComposiusPayloadPluginHealth({
      checks: {
        probe(req) {
          received = req
        },
      },
    })(baseConfig())

    await invoke(config)

    expect(received).toBe(request)
  })

  test('disabled leaves the config untouched', () => {
    const config = ComposiusPayloadPluginHealth({ disabled: true })(baseConfig())

    expect(config.endpoints).toBeUndefined()
  })
})

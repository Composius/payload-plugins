import type { Config, Endpoint, PayloadRequest } from 'payload'

import { describe, expect, test } from 'vitest'

import type { HealthResponse } from '../src/index.js'

import { VWPayloadPluginHealth } from '../src/index.js'

const baseConfig = (): Config => ({ collections: [] }) as unknown as Config

const request = { payload: {} } as unknown as PayloadRequest

const getEndpoint = (config: Config, path = '/health'): Endpoint => {
  const endpoint = config.endpoints?.find((entry) => entry.path === path)
  expect(endpoint).toBeDefined()
  return endpoint!
}

const invoke = async (config: Config, path = '/health') => {
  const response = (await getEndpoint(config, path).handler(request)) as Response
  return { body: (await response.json()) as HealthResponse, response }
}

describe('VWPayloadPluginHealth', () => {
  test('adds a GET /health endpoint by default', () => {
    const config = VWPayloadPluginHealth()(baseConfig())
    const endpoint = getEndpoint(config)

    expect(endpoint.method).toBe('get')
  })

  test('path option overrides the endpoint path', () => {
    const config = VWPayloadPluginHealth({ path: '/status' })(baseConfig())

    expect(getEndpoint(config, '/status').method).toBe('get')
    expect(config.endpoints?.some((entry) => entry.path === '/health')).toBe(false)
  })

  test('preserves pre-existing endpoints', () => {
    const config = baseConfig()
    const existing: Endpoint = {
      path: '/existing',
      method: 'get',
      handler: async () => Response.json({}),
    }
    config.endpoints = [existing]

    const result = VWPayloadPluginHealth()(config)

    expect(result.endpoints).toContain(existing)
    expect(result.endpoints).toHaveLength(2)
  })

  test('responds 200 ok without checks', async () => {
    const config = VWPayloadPluginHealth()(baseConfig())
    const { body, response } = await invoke(config)

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(body.status).toBe('ok')
    expect(Date.parse(body.timestamp)).not.toBeNaN()
    expect(body.checks).toBeUndefined()
  })

  test('responds 200 with per-check results when every check passes', async () => {
    const config = VWPayloadPluginHealth({
      checks: {
        async database() {},
        cache() {},
      },
    })(baseConfig())
    const { body, response } = await invoke(config)

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.checks).toEqual({
      cache: { status: 'ok' },
      database: { status: 'ok' },
    })
  })

  test('responds 503 with the failing check message when a check throws', async () => {
    const config = VWPayloadPluginHealth({
      checks: {
        database() {},
        async cache() {
          throw new Error('connection refused')
        },
      },
    })(baseConfig())
    const { body, response } = await invoke(config)

    expect(response.status).toBe(503)
    expect(body.status).toBe('error')
    expect(body.checks).toEqual({
      cache: { status: 'error', error: 'connection refused' },
      database: { status: 'ok' },
    })
  })

  test('reports non-Error throws as strings', async () => {
    const config = VWPayloadPluginHealth({
      checks: {
        cache() {
          throw 'boom'
        },
      },
    })(baseConfig())
    const { body, response } = await invoke(config)

    expect(response.status).toBe(503)
    expect(body.checks?.cache).toEqual({ status: 'error', error: 'boom' })
  })

  test('checks receive the request', async () => {
    let received: PayloadRequest | undefined
    const config = VWPayloadPluginHealth({
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
    const config = VWPayloadPluginHealth({ disabled: true })(baseConfig())

    expect(config.endpoints).toBeUndefined()
  })
})

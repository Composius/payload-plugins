import type { Endpoint, Payload, PayloadRequest } from 'payload'

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

const getHealthEndpoint = (): Endpoint => {
  const endpoint = payload.config.endpoints.find((entry) => entry.path === '/health')
  expect(endpoint).toBeDefined()
  return endpoint!
}

const invokeHealth = async () => {
  const req = { payload } as unknown as PayloadRequest
  const response = (await getHealthEndpoint().handler(req)) as Response
  return { body: await response.json(), response }
}

describe('Plugin integration tests', () => {
  test('plugin registers the GET /health endpoint', () => {
    expect(getHealthEndpoint().method).toBe('get')
  })

  test('health endpoint reports ok with a passing database check', async () => {
    const { body, response } = await invokeHealth()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      status: 'ok',
      checks: { database: { status: 'ok' } },
    })
  })
})

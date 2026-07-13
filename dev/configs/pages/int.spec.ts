import type { Payload } from 'payload'

import { getPayload } from 'payload'

import config from './config.js'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

let payload: Payload

afterAll(async () => {
  await payload.destroy()
})

beforeAll(async () => {
  payload = await getPayload({ config })
})

describe('Plugin integration tests', () => {
  test('plugin adds the pages collection', () => {
    expect(payload.collections['pages']).toBeDefined()
  })

  test('can create a page', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: {
        slug: 'hello-world',
        publishedAt: new Date().toISOString(),
        title: 'Hello World',
      },
    })

    expect(page.title).toBe('Hello World')
    expect(page.slug).toBe('hello-world')
  })
})

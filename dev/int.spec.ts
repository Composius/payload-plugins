import type { Payload } from 'payload'

import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

let payload: Payload

afterAll(async () => {
  await payload.destroy()
})

beforeAll(async () => {
  payload = await getPayload({ config })
})

describe('Plugin integration tests', () => {
  test('plugin adds the articles collection', () => {
    expect(payload.collections['articles']).toBeDefined()
  })

  test('can create an article', async () => {
    const article = await payload.create({
      collection: 'articles',
      data: {
        slug: 'hello-world',
        publishedAt: new Date().toISOString(),
        title: 'Hello World',
      },
    })

    expect(article.title).toBe('Hello World')
    expect(article.slug).toBe('hello-world')
  })
})

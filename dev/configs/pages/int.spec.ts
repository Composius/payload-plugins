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

  test('a page is laid out with both referenced and inline blocks', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: {
        slug: 'with-layout',
        title: 'With Layout',
        layout: [
          { blockType: 'hero', heading: 'Welcome' },
          { blockType: 'callToAction', href: '/contact', label: 'Say hi' },
        ],
      },
    })

    expect(page.layout).toHaveLength(2)
    expect(page.layout?.[0]).toMatchObject({ blockType: 'hero', heading: 'Welcome' })
    expect(page.layout?.[1]).toMatchObject({ blockType: 'callToAction', label: 'Say hi' })
  })

  // The revalidation hooks run inside the write's transaction, and there is no
  // Next.js request scope here to revalidate against. Every write below must
  // still go through: a cache that cannot be reached is not a failed write.
  test('publishing and deleting survive without a Next.js runtime', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: { _status: 'published', slug: 'cached', title: 'Cached' },
    })

    const renamed = await payload.update({
      collection: 'pages',
      id: page.id,
      data: { slug: 'cached-renamed' },
    })
    expect(renamed.slug).toBe('cached-renamed')

    await payload.delete({ collection: 'pages', id: page.id })

    const remaining = await payload.find({
      collection: 'pages',
      where: { slug: { equals: 'cached-renamed' } },
    })
    expect(remaining.totalDocs).toBe(0)
  })
})

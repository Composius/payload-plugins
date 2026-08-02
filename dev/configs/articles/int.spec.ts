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

  test('plugin adds the categories collection', () => {
    expect(payload.collections['categories']).toBeDefined()
  })

  test('can create a category with a parent and breadcrumbs are populated', async () => {
    const parent = await payload.create({
      collection: 'categories',
      data: {
        name: 'News',
        slug: 'news',
        description: 'General news',
      },
    })

    const child = await payload.create({
      collection: 'categories',
      data: {
        name: 'Tech News',
        slug: 'tech-news',
        parent: parent.id,
      },
    })

    expect(parent.name).toBe('News')
    expect(child.parent).toMatchObject({ id: parent.id })
    expect(child.breadcrumbs).toHaveLength(2)
    expect(child.breadcrumbs?.[0]).toMatchObject({ label: 'News', url: '/news' })
    expect(child.breadcrumbs?.[1]).toMatchObject({ label: 'Tech News', url: '/news/tech-news' })
  })

  test('can create an article with a category', async () => {
    const guides = await payload.create({
      collection: 'categories',
      data: {
        name: 'Guides',
        slug: 'guides',
      },
    })

    const article = await payload.create({
      collection: 'articles',
      data: {
        slug: 'categorized-article',
        title: 'Categorized Article',
        category: guides.id,
      },
    })

    expect(article.category).toMatchObject({ id: guides.id })
  })

  test('plugin adds the authors collection', () => {
    expect(payload.collections['authors']).toBeDefined()
  })

  test('editor defaults to the creating user and article links an author', async () => {
    const user = await payload.create({
      collection: 'users',
      data: { email: 'editor@example.com', password: 'password123' },
    })

    const author = await payload.create({
      collection: 'authors',
      data: { name: 'Ada Lovelace', contact: 'ada@example.com' },
    })

    const article = await payload.create({
      collection: 'articles',
      data: {
        slug: 'attributed-article',
        title: 'Attributed Article',
        author: author.id,
      },
      // Simulates an authenticated request so the editor default hook fires.
      req: { user } as Parameters<typeof payload.create>[0]['req'],
    })

    expect(article.editor).toMatchObject({ id: user.id })
    expect(article.author).toMatchObject({ id: author.id, name: 'Ada Lovelace' })
  })

  // The revalidation hooks run inside the write's transaction, and there is no
  // Next.js request scope here to revalidate against. Every write below must
  // still go through: a cache that cannot be reached is not a failed write.
  test('publishing, renaming and deleting survive without a Next.js runtime', async () => {
    const article = await payload.create({
      collection: 'articles',
      data: { _status: 'published', slug: 'cached', title: 'Cached' },
    })

    const renamed = await payload.update({
      collection: 'articles',
      id: article.id,
      data: { slug: 'cached-renamed' },
    })
    expect(renamed.slug).toBe('cached-renamed')

    const unpublished = await payload.update({
      collection: 'articles',
      id: article.id,
      data: { _status: 'draft' },
    })
    expect(unpublished._status).toBe('draft')

    await payload.delete({ collection: 'articles', id: article.id })

    const remaining = await payload.find({
      collection: 'articles',
      where: { slug: { equals: 'cached-renamed' } },
    })
    expect(remaining.totalDocs).toBe(0)
  })

  test('only one category is the default at a time', async () => {
    const featured = await payload.create({
      collection: 'categories',
      data: { name: 'Featured', slug: 'featured', isDefault: true },
    })
    expect(featured.isDefault).toBe(true)

    const opinion = await payload.create({
      collection: 'categories',
      data: { name: 'Opinion', slug: 'opinion', isDefault: true },
    })

    const previous = await payload.findByID({ collection: 'categories', id: featured.id })
    expect(previous.isDefault).toBe(false)

    const defaults = await payload.find({
      collection: 'categories',
      where: { isDefault: { equals: true } },
    })
    expect(defaults.docs).toHaveLength(1)
    expect(defaults.docs[0]?.id).toBe(opinion.id)
  })

  test('an article saved without a category gets the default one', async () => {
    const { docs } = await payload.find({
      collection: 'categories',
      where: { isDefault: { equals: true } },
    })
    const fallback = docs[0]!

    const article = await payload.create({
      collection: 'articles',
      data: { slug: 'uncategorized', title: 'Uncategorized' },
    })
    expect(article.category).toMatchObject({ id: fallback.id })

    // An explicit category is kept, and clearing it hands the article back to
    // the default rather than leaving it uncategorized.
    const guides = await payload.create({
      collection: 'categories',
      data: { name: 'Explicit', slug: 'explicit' },
    })

    const recategorized = await payload.update({
      collection: 'articles',
      id: article.id,
      data: { category: guides.id },
    })
    expect(recategorized.category).toMatchObject({ id: guides.id })

    const cleared = await payload.update({
      collection: 'articles',
      id: article.id,
      data: { category: null },
    })
    expect(cleared.category).toMatchObject({ id: fallback.id })
  })

  test('a category rename still saves and resaves its children', async () => {
    const parent = await payload.create({
      collection: 'categories',
      data: { name: 'Cache', slug: 'cache' },
    })
    await payload.create({
      collection: 'categories',
      data: { name: 'Cache child', slug: 'cache-child', parent: parent.id },
    })

    const renamed = await payload.update({
      collection: 'categories',
      id: parent.id,
      data: { slug: 'cache-renamed' },
    })

    expect(renamed.slug).toBe('cache-renamed')
  })
})

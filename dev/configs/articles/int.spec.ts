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
})

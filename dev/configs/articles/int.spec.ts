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

  test('can create an article with many categories', async () => {
    const guides = await payload.create({
      collection: 'categories',
      data: {
        name: 'Guides',
        slug: 'guides',
      },
    })

    const tutorials = await payload.create({
      collection: 'categories',
      data: {
        name: 'Tutorials',
        slug: 'tutorials',
      },
    })

    const article = await payload.create({
      collection: 'articles',
      data: {
        slug: 'categorized-article',
        title: 'Categorized Article',
        categories: [guides.id, tutorials.id],
      },
    })

    expect(article.categories).toHaveLength(2)
    expect(article.categories?.[0]).toMatchObject({ id: guides.id })
    expect(article.categories?.[1]).toMatchObject({ id: tutorials.id })
  })
})

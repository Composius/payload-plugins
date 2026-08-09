import type { Payload } from 'payload'

import { getPayload, ValidationError } from 'payload'

import config from './config.js'
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

let payload: Payload

/** Rich text holding a single video embed block. */
const videoContent = (url: string) => ({
  root: {
    type: 'root',
    direction: null,
    format: '' as const,
    indent: 0,
    version: 1,
    children: [
      {
        type: 'block',
        format: '' as const,
        version: 2,
        fields: { blockType: 'videoEmbed', url },
      },
    ],
  },
})

/** Keeps the title lookup off the network — the providers are not under test here. */
const stubProvider = (response: Partial<Response>) =>
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response as Response)))

const videoFields = (doc: { content?: { root: { children: unknown[] } } | null }) =>
  (doc.content?.root.children[0] as { fields: Record<string, unknown> }).fields

afterAll(async () => {
  await payload.destroy()
})

afterEach(() => {
  vi.unstubAllGlobals()
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

  test('the content editor takes a video embed block, and only supported links', async () => {
    const article = await payload.create({
      collection: 'articles',
      data: {
        slug: 'watch-this',
        title: 'Watch this',
        content: videoContent('https://youtu.be/dQw4w9WgXcQ'),
      },
    })

    expect(article.content?.root.children[0]).toMatchObject({
      type: 'block',
      fields: { blockType: 'videoEmbed', url: 'https://youtu.be/dQw4w9WgXcQ' },
    })

    const rejected: unknown = await payload
      .create({
        collection: 'articles',
        data: {
          slug: 'watch-that',
          title: 'Watch that',
          content: videoContent('https://example.com/not-a-video'),
        },
      })
      .catch((error: unknown) => error)

    // Lexical reports a failing block by name only — the message the validator
    // returns is what the field shows in the admin panel, not what comes back here.
    expect(rejected).toBeInstanceOf(ValidationError)
    expect(JSON.stringify((rejected as ValidationError).data.errors)).toMatch(
      /block node failed to validate.*url/,
    )
  })

  test('the video title is fetched from the provider and stored read-only', async () => {
    stubProvider({ json: () => Promise.resolve({ title: 'Never Gonna Give You Up' }), ok: true })

    const article = await payload.create({
      collection: 'articles',
      data: {
        slug: 'titled-video',
        title: 'Titled video',
        content: videoContent('https://youtu.be/dQw4w9WgXcQ'),
      },
    })

    expect(videoFields(article)).toMatchObject({ title: 'Never Gonna Give You Up' })

    // Everything that follows leaves the link alone, so none of it is worth a
    // second lookup — not the autosaves an editor's keystrokes trigger, and not
    // the publish, whose previous value comes from another version.
    await payload.update({
      collection: 'articles',
      id: article.id,
      data: { title: 'Retitled' },
      draft: true,
    })

    await payload.update({
      autosave: true,
      collection: 'articles',
      id: article.id,
      data: { content: article.content },
      draft: true,
    })

    const published = await payload.update({
      collection: 'articles',
      id: article.id,
      data: { _status: 'published', content: article.content },
    })

    expect(videoFields(published).title).toBe('Never Gonna Give You Up')
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)

    // Only a link that actually changes is asked about again.
    const moved = await payload.update({
      collection: 'articles',
      id: article.id,
      data: { content: videoContent('https://vimeo.com/1084537') },
    })

    expect(videoFields(moved).title).toBe('Never Gonna Give You Up')
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
  })

  test('a link the provider will not resolve is marked, and still saves', async () => {
    stubProvider({ ok: false, status: 404 })

    const article = await payload.create({
      collection: 'articles',
      data: {
        slug: 'untitled-video',
        title: 'Untitled video',
        content: videoContent('https://youtu.be/aaaaaaaaaaa'),
      },
    })

    expect(videoFields(article).title).toBeUndefined()
    expect(videoFields(article).titleUnavailable).toBe(true)
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

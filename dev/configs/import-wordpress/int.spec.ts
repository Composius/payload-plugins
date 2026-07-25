import type { Payload } from 'payload'

import { getPayload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import config from './config.js'

let payload: Payload

// A 1×1 PNG — a valid image sharp can process.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

const SITE = 'https://site.com'
const COVER = 'https://site.com/wp-content/uploads/2021/06/cover.jpg'
const SHARED = 'https://site.com/wp-content/uploads/2021/06/shared-1024x768.jpg'

const categories = [
  { id: 1, name: 'News', parent: 0, slug: 'news' },
  { id: 2, name: 'Sub', parent: 1, slug: 'sub' },
]

const embedded = {
  author: [{ id: 5, name: 'Jane Doe', slug: 'jane' }],
  'wp:featuredmedia': [{ id: 99, alt_text: 'Cover', source_url: COVER }],
}

const posts = [
  {
    id: 10,
    author: 5,
    categories: [1],
    content: {
      rendered:
        '<p>Hello</p><figure><img src="' +
        SHARED +
        '"/></figure><p>See <a href="https://site.com/second-post/">second</a>, ' +
        '<a href="https://external.com/x">ext</a> and ' +
        '<a href="https://site.com/nonexistent/">missing</a>.</p>',
    },
    date_gmt: '2021-06-01T10:00:00',
    excerpt: { rendered: '<p>First&rsquo;s excerpt&hellip;</p>' },
    featured_media: 99,
    link: 'https://site.com/first-post/',
    slug: 'first-post',
    status: 'publish',
    title: { rendered: 'First &amp; Post' },
    _embedded: embedded,
  },
  {
    id: 11,
    author: 5,
    categories: [2],
    // No featured media: the leading content image is promoted to the cover.
    content: {
      rendered:
        '<img src="' +
        SHARED +
        '"/><p>World</p><p>Back to <a href="https://site.com/first-post/">first</a>.</p>',
    },
    date_gmt: '2021-06-02T10:00:00',
    excerpt: { rendered: '<p>Second excerpt</p>' },
    featured_media: 0,
    link: 'https://site.com/second-post/',
    slug: 'second-post',
    status: 'publish',
    title: { rendered: 'Second Post' },
    _embedded: { author: embedded.author },
  },
]

// A second site with its own posts, used by the resume/run-history test.
const SITE3 = 'https://site3.com'
const site3Posts = [20, 21].map((id) => ({
  id,
  author: 5,
  categories: [],
  content: { rendered: `<p>Body of post ${id}</p>` },
  date_gmt: `2022-01-0${id - 19}T10:00:00`,
  excerpt: { rendered: '' },
  featured_media: 0,
  link: `https://site3.com/post-${id}/`,
  slug: `post-${id}`,
  status: 'publish',
  title: { rendered: `Post ${id}` },
  _embedded: { author: embedded.author },
}))

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json', 'X-WP-TotalPages': '1' },
  })

/** Routes WordPress REST + image requests to canned responses. */
const wpFetch = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === 'string' ? input : input.toString()
  if (url.includes('/wp-content/uploads/')) {
    return new Response(PNG, { headers: { 'content-type': 'image/png' } })
  }
  if (url.includes('/wp-json/wp/v2/categories')) {
    return jsonResponse(url.startsWith(SITE3) ? [] : categories)
  }
  if (url.includes('/wp-json/wp/v2/posts')) {
    return jsonResponse(url.startsWith(SITE3) ? site3Posts : posts)
  }
  if (url.includes('/wp-json/wp/v2/users/5')) {
    // Email is only exposed to authenticated (context=edit) requests.
    return url.includes('context=edit')
      ? jsonResponse({ id: 5, name: 'Jane Doe', slug: 'jane', email: 'jane@real.example' })
      : jsonResponse({ id: 5, name: 'Jane Doe', slug: 'jane' })
  }
  return new Response('not found', { status: 404 })
})

const runJob = async (data: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const job = await payload.create({ collection: 'wp-import-jobs', data } as never)
  await payload.jobs.run()
  return (await payload.findByID({
    collection: 'wp-import-jobs',
    id: job.id,
    depth: 0,
  })) as unknown as Record<string, unknown>
}

const count = (collection: string) => payload.count({ collection: collection as never })

beforeAll(async () => {
  payload = await getPayload({ config })
})

afterAll(async () => {
  await payload.destroy()
})

beforeEach(() => {
  vi.stubGlobal('fetch', wpFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  wpFetch.mockClear()
})

describe('WordPress import', () => {
  test('registers the import collections and task', () => {
    expect(payload.collections['wp-import-jobs']).toBeDefined()
    expect(payload.collections['wp-import-records']).toBeDefined()
    expect(payload.collections['redirects']).toBeDefined()
  })

  test('dry run reports a plan but writes nothing', async () => {
    const job = await runJob({ dryRun: true, sourceUrl: SITE })

    const postsReport = job.postsReport as { dryRun: boolean; imported: unknown[] }
    expect(job.status).toBe('completed')
    expect(postsReport.dryRun).toBe(true)
    expect(postsReport.imported).toHaveLength(2)

    // Nothing was written.
    expect((await count('articles')).totalDocs).toBe(0)
    expect((await count('media')).totalDocs).toBe(0)
    expect((await count('wp-import-records')).totalDocs).toBe(0)
  })

  test('real import creates posts, dedupes images, rewrites links and redirects', async () => {
    const job = await runJob({ sourceUrl: SITE })
    expect(job.status).toBe('completed')

    // Two posts imported.
    expect((await count('articles')).totalDocs).toBe(2)

    // Categories with preserved hierarchy.
    const cats = await payload.find({ collection: 'categories', depth: 0 })
    expect(cats.totalDocs).toBe(2)
    const sub = cats.docs.find((c) => (c as { slug?: string }).slug === 'sub') as {
      parent?: unknown
    }
    expect(sub.parent).toBeTruthy()

    // Featured + shared content image → 2 unique media (deduped across posts).
    expect((await count('media')).totalDocs).toBe(2)

    // Redirects from both old permalinks.
    expect((await count('redirects')).totalDocs).toBe(2)

    // Author mapped into users (jane) + the seeded dev user.
    const users = await payload.find({ collection: 'users', depth: 0 })
    expect(users.docs.some((u) => String((u as { email?: string }).email).includes('jane'))).toBe(
      true,
    )

    // The per-step reports capture what happened.
    const postsReport = job.postsReport as { imported: unknown[] }
    const mediaReport = job.mediaReport as { imported: unknown[] }
    const { links } = job.linksReport as { links: Array<{ action: string; from: string }> }
    expect(postsReport.imported).toHaveLength(2)
    expect(mediaReport.imported).toHaveLength(2)
    expect(links.some((l) => l.action === 'rewritten')).toBe(true)
    expect(links.some((l) => l.action === 'unresolved' && l.from.includes('nonexistent'))).toBe(
      true,
    )

    // A post's content has an upload node and a rewritten internal link.
    const first = await payload.find({
      collection: 'articles',
      where: { slug: { equals: 'first-post' } },
      depth: 0,
    })
    const content = JSON.stringify((first.docs[0] as { content?: unknown }).content)
    expect(content).toContain('"type":"upload"')
    expect(content).toContain('/articles/second-post')
    // Title HTML entity decoded.
    expect((first.docs[0] as { title?: string }).title).toBe('First & Post')

    // SEO meta: title from the post title, image from the cover, description
    // from the excerpt.
    const firstDoc = first.docs[0] as {
      coverImage?: unknown
      meta?: { description?: string; image?: unknown; title?: string }
    }
    expect(firstDoc.meta?.title).toBe('First & Post')
    expect(firstDoc.meta?.image).toEqual(firstDoc.coverImage)
    // Named entities in the excerpt are decoded.
    expect(firstDoc.meta?.description).toBe('First’s excerpt…')

    // Post without featured media: the leading content image was promoted to
    // the cover and removed from the content.
    const second = await payload.find({
      collection: 'articles',
      where: { slug: { equals: 'second-post' } },
      depth: 0,
    })
    expect((second.docs[0] as { coverImage?: unknown }).coverImage).toBeTruthy()
    const secondContent = JSON.stringify((second.docs[0] as { content?: unknown }).content)
    expect(secondContent).not.toContain('"type":"upload"')
  })

  test('second run is idempotent (skips already-imported posts)', async () => {
    const before = (await count('articles')).totalDocs
    const beforeMedia = (await count('media')).totalDocs

    const job = await runJob({ sourceUrl: SITE })
    const progress = job.progress as { importedPosts: number; skippedPosts: number }

    expect(progress.importedPosts).toBe(0)
    expect(progress.skippedPosts).toBe(2)
    expect((await count('articles')).totalDocs).toBe(before)
    expect((await count('media')).totalDocs).toBe(beforeMedia)
  })

  test('resume merges reports and tags items with their run number', async () => {
    // Run 1: only the first post (limit 1).
    const job = await payload.create({
      collection: 'wp-import-jobs',
      data: { limit: 1, sourceUrl: SITE3 },
    } as never)
    await payload.jobs.run()

    // Resume with a higher limit → run 2 imports the second post.
    await payload.update({
      collection: 'wp-import-jobs',
      id: job.id,
      data: { limit: 2, resume: true },
    } as never)
    await payload.jobs.run()

    const updated = (await payload.findByID({
      collection: 'wp-import-jobs',
      id: job.id,
      depth: 0,
    })) as unknown as Record<string, unknown>

    // Both runs are in the history, completed, with per-run progress.
    const runs = updated.runs as Array<{ progress?: { importedPosts: number }; run: number; status: string }>
    expect(runs.map((r) => r.run)).toEqual([1, 2])
    expect(runs.every((r) => r.status === 'completed')).toBe(true)
    expect(runs[0].progress?.importedPosts).toBe(1)
    expect(runs[1].progress?.importedPosts).toBe(1)

    // The report kept run 1's post and tagged each item with its run.
    const { imported } = updated.postsReport as {
      imported: Array<{ run?: number; slug?: string }>
    }
    expect(imported).toHaveLength(2)
    expect(imported[0]).toMatchObject({ run: 1, slug: 'post-20' })
    expect(imported[1]).toMatchObject({ run: 2, slug: 'post-21' })
  })

  test('credentials authenticate requests and fetch author emails', async () => {
    // A different site host so nothing is skipped via existing import records.
    await runJob({
      credentials: { applicationPassword: 'abcd 1234', username: 'admin' },
      dryRun: true,
      sourceUrl: 'https://site2.com',
    })

    const calls = wpFetch.mock.calls as unknown as Array<[unknown, RequestInit | undefined]>
    const userCall = calls.find(([input]) => String(input).includes('/wp-json/wp/v2/users/5'))
    expect(userCall).toBeDefined()
    expect(String(userCall![0])).toContain('context=edit')

    const headers = (userCall![1]?.headers ?? {}) as Record<string, string>
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from('admin:abcd 1234').toString('base64')}`,
    )
  })
})

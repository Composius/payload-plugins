import type { Config } from 'payload'

import { describe, expect, test } from 'vitest'

import type { LexNode } from '../src/lib/lexical.js'
import type { WPCategory, WPPost } from '../src/lib/wpTypes.js'

import { authenticated, resolveOptions } from '../src/defaults.js'
import { ComposiusPayloadPluginImportWordpress } from '../src/index.js'
import { sortCategoriesParentsFirst } from '../src/lib/categories.js'
import {
  buildUploadNode,
  extractImageSrcs,
  imageToken,
  removeLeadingUploadNode,
  replaceImageTokens,
  rewriteLinkNodes,
  takeFirstUploadNode,
} from '../src/lib/lexical.js'
import { publishDate, selectPrimaryCategoryId } from '../src/lib/post.js'
import {
  decodeEntities,
  deriveOriginalImageUrl,
  filenameOf,
  isInternalUrl,
  pathOf,
  permalinkToSlug,
  stripHtml,
} from '../src/lib/url.js'
import { createWPClient, restBase } from '../src/lib/wpClient.js'

const baseConfig = (): Config => ({ collections: [] }) as unknown as Config

describe('url helpers', () => {
  test('deriveOriginalImageUrl strips the WordPress size suffix', () => {
    expect(deriveOriginalImageUrl('https://x.com/a/photo-1024x768.jpg')).toBe(
      'https://x.com/a/photo.jpg',
    )
    expect(deriveOriginalImageUrl('https://x.com/a/photo.jpg')).toBe('https://x.com/a/photo.jpg')
    expect(deriveOriginalImageUrl('https://x.com/a/photo-300x300.png?ver=2')).toBe(
      'https://x.com/a/photo.png?ver=2',
    )
  })

  test('isInternalUrl compares hosts and treats relative URLs as internal', () => {
    expect(isInternalUrl('https://blog.example.com/post', 'blog.example.com')).toBe(true)
    expect(isInternalUrl('/post', 'blog.example.com')).toBe(true)
    expect(isInternalUrl('https://other.com/post', 'blog.example.com')).toBe(false)
    expect(isInternalUrl('#anchor', 'blog.example.com')).toBe(false)
    expect(isInternalUrl('mailto:a@b.com', 'blog.example.com')).toBe(false)
  })

  test('permalinkToSlug returns the last path segment', () => {
    expect(permalinkToSlug('https://x.com/2020/01/my-post/')).toBe('my-post')
    expect(permalinkToSlug('https://x.com/my-post')).toBe('my-post')
    expect(permalinkToSlug('https://x.com/')).toBe(null)
  })

  test('pathOf and filenameOf', () => {
    expect(pathOf('https://x.com/a/b/?q=1#h')).toBe('/a/b/')
    expect(pathOf('/a/b')).toBe('/a/b')
    expect(filenameOf('https://x.com/a/photo.jpg')).toBe('photo.jpg')
  })

  test('decodeEntities and stripHtml', () => {
    expect(decodeEntities('Tom &amp; Jerry &#8217;s')).toBe('Tom & Jerry ’s')
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world')
  })

  test('decodeEntities handles named and hex entities', () => {
    expect(decodeEntities('It&rsquo;s here&hellip;')).toBe('It’s here…')
    expect(decodeEntities('caf&eacute; &laquo;&nbsp;ok&nbsp;&raquo;')).toBe('café « ok »')
    expect(decodeEntities('&#x2019; and &#X2019;')).toBe('’ and ’')
    // Double-encoded entities are decoded exactly once.
    expect(decodeEntities('&amp;rsquo;')).toBe('&rsquo;')
    // Unknown named entities are left untouched.
    expect(decodeEntities('&unknownthing;')).toBe('&unknownthing;')
  })
})

describe('wpClient restBase', () => {
  test('normalizes to the v2 REST base', () => {
    expect(restBase('https://x.com/')).toBe('https://x.com/wp-json/wp/v2')
    expect(restBase('https://x.com')).toBe('https://x.com/wp-json/wp/v2')
  })
})

describe('wpClient credentials', () => {
  const recordingFetch = (calls: Array<{ headers: Record<string, string>; url: string }>) =>
    (async (input: unknown, init?: { headers?: Record<string, string> }) => {
      calls.push({ headers: init?.headers ?? {}, url: String(input) })
      return new Response(JSON.stringify({ id: 5, email: 'a@b.c' }), {
        headers: { 'X-WP-TotalPages': '1' },
      })
    }) as unknown as typeof fetch

  test('sends Basic auth and requests users with context=edit', async () => {
    const calls: Array<{ headers: Record<string, string>; url: string }> = []
    const client = createWPClient(
      'https://x.com',
      { credentials: { applicationPassword: 'pw 12', username: 'admin' }, timeoutMs: 1000 },
      recordingFetch(calls),
    )

    expect(client.authenticated).toBe(true)
    const user = await client.fetchUser(5)
    expect(user?.email).toBe('a@b.c')
    expect(calls[0].url).toContain('/users/5?context=edit')
    expect(calls[0].headers.Authorization).toBe(
      `Basic ${Buffer.from('admin:pw 12').toString('base64')}`,
    )
  })

  test('without credentials there is no auth header and no context=edit', async () => {
    const calls: Array<{ headers: Record<string, string>; url: string }> = []
    const client = createWPClient('https://x.com', { timeoutMs: 1000 }, recordingFetch(calls))

    expect(client.authenticated).toBe(false)
    await client.fetchUser(5)
    expect(calls[0].url).not.toContain('context=edit')
    expect(calls[0].headers.Authorization).toBeUndefined()
  })
})

describe('category ordering', () => {
  test('parents come before their children', () => {
    const cats: WPCategory[] = [
      { id: 3, name: 'Child', parent: 1 },
      { id: 1, name: 'Root', parent: 0 },
      { id: 2, name: 'Mid', parent: 1 },
      { id: 4, name: 'Grandchild', parent: 3 },
    ]
    const ordered = sortCategoriesParentsFirst(cats).map((c) => c.id)
    expect(ordered.indexOf(1)).toBeLessThan(ordered.indexOf(3))
    expect(ordered.indexOf(3)).toBeLessThan(ordered.indexOf(4))
    expect(ordered).toHaveLength(4)
  })
})

describe('post helpers', () => {
  test('selectPrimaryCategoryId returns the first category', () => {
    expect(selectPrimaryCategoryId({ categories: [7, 8], id: 1 } as WPPost)).toBe(7)
    expect(selectPrimaryCategoryId({ id: 1 } as WPPost)).toBe(null)
  })

  test('publishDate prefers GMT and returns ISO', () => {
    expect(publishDate({ date_gmt: '2021-06-01T10:00:00', id: 1 } as WPPost)).toBe(
      '2021-06-01T10:00:00.000Z',
    )
  })
})

describe('lexical transforms', () => {
  test('extractImageSrcs finds every img src in order', () => {
    const html = '<p>a</p><img src="one.jpg"><figure><img src=\'two.png\'></figure>'
    expect(extractImageSrcs(html)).toEqual(['one.jpg', 'two.png'])
  })

  test('replaceImageTokens swaps token paragraphs for upload nodes', () => {
    const root: LexNode = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', text: 'Intro' }] },
        { type: 'paragraph', children: [{ type: 'text', text: imageToken(0) }] },
      ],
    }
    replaceImageTokens(root, (i) => (i === 0 ? 'media-1' : null), 'media')
    expect(root.children?.[1]).toMatchObject({
      type: 'upload',
      relationTo: 'media',
      value: 'media-1',
    })
  })

  test('replaceImageTokens drops unresolved placeholders', () => {
    const root: LexNode = {
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', text: imageToken(0) }] }],
    }
    replaceImageTokens(root, () => null, 'media')
    expect(root.children).toHaveLength(0)
  })

  test('buildUploadNode shape', () => {
    expect(buildUploadNode(5, 'media')).toMatchObject({ relationTo: 'media', type: 'upload', value: 5 })
  })

  test('takeFirstUploadNode removes and returns the first upload in document order', () => {
    const root: LexNode = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', text: 'Intro' }] },
        { type: 'upload', value: 'media-1', relationTo: 'media' },
        { type: 'upload', value: 'media-2', relationTo: 'media' },
      ],
    }
    expect(takeFirstUploadNode(root)).toBe('media-1')
    expect(root.children).toHaveLength(2)
    expect(root.children?.[1]).toMatchObject({ type: 'upload', value: 'media-2' })
    expect(takeFirstUploadNode({ type: 'root', children: [] })).toBe(null)
  })

  test('removeLeadingUploadNode drops the hero duplicate only when it leads', () => {
    const leading: LexNode = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', text: '  ' }] },
        { type: 'upload', value: 7, relationTo: 'media' },
        { type: 'paragraph', children: [{ type: 'text', text: 'Body' }] },
      ],
    }
    expect(removeLeadingUploadNode(leading, '7')).toBe(true)
    expect(leading.children?.some((c) => c.type === 'upload')).toBe(false)

    const inline: LexNode = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', text: 'Body first' }] },
        { type: 'upload', value: 7, relationTo: 'media' },
      ],
    }
    expect(removeLeadingUploadNode(inline, 7)).toBe(false)
    expect(inline.children?.some((c) => c.type === 'upload')).toBe(true)

    const otherImage: LexNode = {
      type: 'root',
      children: [{ type: 'upload', value: 8, relationTo: 'media' }],
    }
    expect(removeLeadingUploadNode(otherImage, 7)).toBe(false)
  })

  test('rewriteLinkNodes rewrites resolved internal links and flags the rest', () => {
    const root: LexNode = {
      type: 'root',
      children: [
        { type: 'link', fields: { linkType: 'custom', url: 'https://site.com/kept-post/' }, children: [] },
        { type: 'link', fields: { linkType: 'custom', url: 'https://site.com/gone/' }, children: [] },
        { type: 'link', fields: { linkType: 'custom', url: 'https://external.com/x' }, children: [] },
      ],
    }
    const links = rewriteLinkNodes(root, {
      articleUrl: (slug) => `https://new.com/articles/${slug}`,
      resolveInternal: (_url, slug) => (slug === 'kept-post' ? 'kept-post' : null),
      siteHost: 'site.com',
    })

    expect(links).toEqual([
      { action: 'rewritten', from: 'https://site.com/kept-post/', to: 'https://new.com/articles/kept-post' },
      { action: 'unresolved', from: 'https://site.com/gone/' },
    ])
    // The external link is untouched and not reported.
    expect((root.children?.[0].fields as { url: string }).url).toBe('https://new.com/articles/kept-post')
    expect((root.children?.[2].fields as { url: string }).url).toBe('https://external.com/x')
  })
})

describe('resolveAuthor without email', () => {
  const stubPayload = {
    find: async () => ({ docs: [], totalDocs: 0 }),
  } as never

  const baseArgs = {
    authorsSlug: 'authors',
    dryRun: false,
    imageCache: new Map(),
    jobId: 1,
    mediaSlug: 'media',
    site: 'site.com',
    strategy: 'users' as const,
    timeoutMs: 1000,
    usersSlug: 'users',
    wpUser: { id: 5, name: 'Jane', slug: 'jane' },
  }

  test('syntheticEmailDomain: false skips creation and reports the author', async () => {
    const { resolveAuthor } = await import('../src/lib/authors.js')
    const result = await resolveAuthor(stubPayload, {
      ...baseArgs,
      syntheticEmailDomain: false,
    })
    expect(result.author).toBe(null)
    expect(result.skippedNoEmail).toEqual({ name: 'Jane', sourceId: 5 })
  })

  test('syntheticEmailDomain: false falls back to defaultUserId when set', async () => {
    const { resolveAuthor } = await import('../src/lib/authors.js')
    const result = await resolveAuthor(stubPayload, {
      ...baseArgs,
      defaultUserId: 42,
      syntheticEmailDomain: false,
    })
    expect(result.author).toEqual({ field: 'editor', value: 42 })
    expect(result.skippedNoEmail).toEqual({ name: 'Jane', sourceId: 5 })
  })
})

describe('rehydrateReport', () => {
  test('keeps real-run entries, drops dry-run entries, and numbers the next run', async () => {
    const { rehydrateReport } = await import('../src/lib/report.js')
    const { previousRuns, report, runNumber } = rehydrateReport(
      {
        linksReport: {
          links: [
            { action: 'rewritten', from: '/a', run: 1 },
            { action: 'unresolved', from: '/b', run: 2 },
          ],
        },
        postsReport: {
          imported: [
            { run: 1, sourceId: 10, targetId: 'dry-run' },
            { run: 2, sourceId: 10, targetId: 5 },
            { sourceId: 11, targetId: 6 }, // legacy untagged entry
          ],
        },
        runs: [
          { dryRun: true, run: 1, startedAt: 'x', status: 'completed' },
          { dryRun: false, run: 2, startedAt: 'y', status: 'completed' },
        ],
      },
      false,
    )

    expect(runNumber).toBe(3)
    expect(previousRuns).toHaveLength(2)
    // The dry run's planned post is dropped, the real + legacy ones kept.
    expect(report.imported.posts).toEqual([
      { run: 2, sourceId: 10, targetId: 5 },
      { sourceId: 11, targetId: 6 },
    ])
    expect(report.links).toEqual([{ action: 'unresolved', from: '/b', run: 2 }])
  })

  test('starts at run 1 with empty history', async () => {
    const { rehydrateReport } = await import('../src/lib/report.js')
    const { report, runNumber } = rehydrateReport({}, true)
    expect(runNumber).toBe(1)
    expect(report.imported.posts).toEqual([])
    expect(report.dryRun).toBe(true)
  })
})

describe('resolveOptions', () => {
  test('applies documented defaults', () => {
    const options = resolveOptions({})
    expect(options.collections).toEqual({
      articles: 'articles',
      authors: 'authors',
      categories: 'categories',
      media: 'media',
      users: 'users',
    })
    expect(options.authorMapping.strategy).toBe('users')
    expect(options.authorMapping.syntheticEmailDomain).toBe('imported.invalid')
    expect(options.excerptToSeoDescription).toBe(true)
    expect(options.firstImageAsCover).toBe(true)
    expect(options.redirects).toBe(true)
    expect(options.dryRunPageLimit).toBe(1)
    expect(options.fieldMap.content).toBe('content')
    expect(options.access.read).toBe(authenticated)
  })

  test('honors overrides', () => {
    const options = resolveOptions({
      authorMapping: { defaultUserId: 9, strategy: 'fixed', syntheticEmailDomain: false },
      collections: { articles: 'posts' },
      redirects: false,
    })
    expect(options.collections.articles).toBe('posts')
    expect(options.authorMapping).toMatchObject({
      defaultUserId: 9,
      strategy: 'fixed',
      syntheticEmailDomain: false,
    })
    expect(options.redirects).toBe(false)
  })
})

describe('ComposiusPayloadPluginImportWordpress', () => {
  const findSlugs = (config: Config): string[] =>
    (config.collections ?? []).map((c) => c.slug)

  test('registers the import collections and the job task', async () => {
    const config = await ComposiusPayloadPluginImportWordpress({ redirects: false })(baseConfig())
    expect(findSlugs(config)).toEqual(expect.arrayContaining(['wp-import-jobs', 'wp-import-records']))
    expect(config.jobs?.tasks?.some((t) => (t as { slug: string }).slug === 'importWordpress')).toBe(
      true,
    )
    expect(config.endpoints?.some((e) => e.path === '/wp-import/start')).toBe(true)
    expect(config.endpoints?.some((e) => e.path === '/wp-import/status/:id')).toBe(true)
  })

  test('applies @payloadcms/plugin-redirects when redirects is enabled', async () => {
    const config = await ComposiusPayloadPluginImportWordpress({ redirects: true })(baseConfig())
    expect(findSlugs(config)).toContain('redirects')
  })

  test('adds an auto-run schedule when requested', async () => {
    const config = await ComposiusPayloadPluginImportWordpress({ autoRun: true, redirects: false })(
      baseConfig(),
    )
    expect(Array.isArray(config.jobs?.autoRun)).toBe(true)
    expect((config.jobs?.autoRun as Array<{ cron: string }>)[0].cron).toBe('* * * * *')
  })

  test('disabled still registers collections but skips endpoints', async () => {
    const config = await ComposiusPayloadPluginImportWordpress({ disabled: true })(baseConfig())
    expect(findSlugs(config)).toEqual(expect.arrayContaining(['wp-import-jobs', 'wp-import-records']))
    expect(config.endpoints ?? []).toHaveLength(0)
  })

  test('job form is organized into step tabs with credentials in configuration', async () => {
    const config = await ComposiusPayloadPluginImportWordpress({ redirects: false })(baseConfig())
    const jobs = config.collections?.find((c) => c.slug === 'wp-import-jobs')
    const tabsField = jobs?.fields[0] as {
      tabs: Array<{ fields: unknown[]; label: Record<string, string> }>
      type: string
    }

    expect(tabsField.type).toBe('tabs')
    expect(tabsField.tabs.map((tab) => tab.label.en)).toEqual([
      'Configuration',
      'Authors',
      'Categories',
      'Media',
      'Posts',
      'Links & redirects',
      'Report',
    ])

    const configurationFields = tabsField.tabs[0].fields.map(
      (field) => (field as { name?: string }).name,
    )
    expect(configurationFields).toContain('sourceUrl')
    expect(configurationFields).toContain('credentials')
    expect(configurationFields).toContain('dryRun')

    // The application password renders masked via the plugin's client field.
    const credentials = tabsField.tabs[0].fields.find(
      (field) => (field as { name?: string }).name === 'credentials',
    ) as { fields: Array<{ fields: Array<Record<string, unknown>> }> }
    const appPassword = credentials.fields[0].fields.find(
      (field) => field.name === 'applicationPassword',
    ) as { admin?: { components?: { Field?: string } } }
    expect(appPassword.admin?.components?.Field).toBe(
      '@composius/payload-plugin-import-wordpress/client#ApplicationPasswordFieldClient',
    )
  })

  test('default access requires an authenticated user', async () => {
    const config = await ComposiusPayloadPluginImportWordpress({ redirects: false })(baseConfig())
    const jobs = config.collections?.find((c) => c.slug === 'wp-import-jobs')
    expect(jobs?.access?.read).toBe(authenticated)
    expect(jobs?.access?.create).toBe(authenticated)
  })
})

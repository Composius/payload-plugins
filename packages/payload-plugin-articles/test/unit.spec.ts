import type { Access, CollectionConfig, Config, Field, FieldAccess } from 'payload'

import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  anyone,
  authenticated,
  authenticatedField,
  authenticatedOrPublished,
  defaultArticleUrl,
  defaultGenerateDescription,
  defaultGenerateImage,
  defaultGenerateTitle,
  defaultGenerateURL,
  SEO_DESCRIPTION_MAX_LENGTH,
} from '../src/defaults.js'
import {
  articleIdTag,
  articleTag,
  ARTICLES_TAG,
  authorIdTag,
  AUTHORS_TAG,
  categoryIdTag,
  categoryTag,
  CATEGORIES_TAG,
  ComposiusPayloadPluginArticles,
} from '../src/index.js'

const accessArgs = (user: unknown) => ({ req: { user } }) as Parameters<Access>[0]

const generateArgs = (doc: unknown) =>
  ({ doc }) as Parameters<ReturnType<typeof defaultGenerateURL>>[0]

const richText = (...paragraphs: string[]) => ({
  root: {
    children: paragraphs.map((text) => ({
      children: [{ text }],
    })),
  },
})

const baseConfig = (): Config => ({ collections: [] }) as unknown as Config

const findCollection = (config: Config, slug: string): CollectionConfig => {
  const collection = config.collections?.find((candidate) => candidate.slug === slug)
  expect(collection).toBeDefined()
  return collection!
}

const findArticles = (config: Config): CollectionConfig => findCollection(config, 'articles')

const findCategories = (config: Config): CollectionConfig => findCollection(config, 'categories')

const findAuthors = (config: Config): CollectionConfig => findCollection(config, 'authors')

const findField = (collection: CollectionConfig, name: string): Field =>
  collection.fields.find((field) => (field as { name?: string }).name === name) as Field

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('access defaults', () => {
  test('authenticated allows only requests with a user', () => {
    expect(authenticated(accessArgs({ id: 1 }))).toBe(true)
    expect(authenticated(accessArgs(null))).toBe(false)
  })

  test('authenticatedOrPublished allows users, otherwise constrains to published docs', () => {
    expect(authenticatedOrPublished(accessArgs({ id: 1 }))).toBe(true)
    expect(authenticatedOrPublished(accessArgs(null))).toEqual({
      _status: { equals: 'published' },
    })
  })
})

describe('defaultArticleUrl', () => {
  test('uses NEXT_PUBLIC_SERVER_URL when set', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://example.com')
    vi.stubEnv('SERVER_URL', 'https://ignored.com')
    expect(defaultArticleUrl('my-article')).toBe('https://example.com/articles/my-article')
  })

  test('falls back to SERVER_URL when NEXT_PUBLIC_SERVER_URL is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', '')
    vi.stubEnv('SERVER_URL', 'https://example.com')
    expect(defaultArticleUrl('my-article')).toBe('https://example.com/articles/my-article')
  })

  test('falls back to localhost and tolerates a missing slug', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', '')
    vi.stubEnv('SERVER_URL', '')
    expect(defaultArticleUrl(null)).toBe('http://localhost:3000/articles/')
  })
})

describe('SEO generate defaults', () => {
  test('generateTitle returns the article title or an empty string', () => {
    expect(defaultGenerateTitle(generateArgs({ title: 'Hello' }))).toBe('Hello')
    expect(defaultGenerateTitle(generateArgs({}))).toBe('')
  })

  test('generateDescription flattens rich text into plain text', () => {
    const doc = { content: richText('First paragraph.', 'Second paragraph.') }
    expect(defaultGenerateDescription(generateArgs(doc))).toBe('First paragraph. Second paragraph.')
  })

  test('generateDescription truncates to the SEO limit', () => {
    const doc = { content: richText('a'.repeat(500)) }
    expect(defaultGenerateDescription(generateArgs(doc))).toHaveLength(SEO_DESCRIPTION_MAX_LENGTH)
  })

  test('generateDescription returns an empty string for missing content', () => {
    expect(defaultGenerateDescription(generateArgs({}))).toBe('')
  })

  test('generateImage resolves populated uploads, ids, and missing values', () => {
    expect(defaultGenerateImage(generateArgs({ coverImage: { id: 'img-1' } }))).toBe('img-1')
    expect(defaultGenerateImage(generateArgs({ coverImage: 'img-2' }))).toBe('img-2')
    expect(defaultGenerateImage(generateArgs({}))).toBe('')
  })

  test('generateURL builds the URL from the article slug', () => {
    const generateURL = defaultGenerateURL((slug) => `https://example.com/a/${slug}`)
    expect(generateURL(generateArgs({ slug: 'my-article' }))).toBe(
      'https://example.com/a/my-article',
    )
  })
})

describe('ComposiusPayloadPluginArticles', () => {
  test('adds the articles collection', () => {
    const config = ComposiusPayloadPluginArticles()(baseConfig())
    const articles = findArticles(config)

    expect(articles.versions).toMatchObject({ drafts: { autosave: true } })
    const fieldNames = articles.fields.map((field) => (field as { name?: string }).name)
    expect(fieldNames).toContain('title')
    expect(fieldNames).toContain('content')
  })

  test('adds the categories collection', () => {
    const config = ComposiusPayloadPluginArticles()(baseConfig())
    const categories = findCategories(config)

    const fieldNames = categories.fields.flatMap((field) =>
      field.type === 'row'
        ? field.fields.map((rowField) => (rowField as { name?: string }).name)
        : [(field as { name?: string }).name],
    )
    expect(fieldNames).toContain('name')
    expect(fieldNames).toContain('slug')
    expect(fieldNames).toContain('parent')
    expect(fieldNames).toContain('description')
    expect(fieldNames).toContain('breadcrumbs')
  })

  test('categories list view gets an article count column', () => {
    const config = ComposiusPayloadPluginArticles()(baseConfig())
    const categories = findCategories(config)

    expect(categories.admin?.defaultColumns).toContain('articleCount')
    const articleCount = categories.fields.find(
      (field) => (field as { name?: string }).name === 'articleCount',
    )
    expect(articleCount).toMatchObject({ type: 'ui' })
    expect(
      (articleCount as { admin?: { components?: { Cell?: unknown } } }).admin?.components?.Cell,
    ).toBe('@composius/payload-plugin-articles/client#CategoryArticleCountCell')
  })

  test('articles get a single category relationship to categories', () => {
    const config = ComposiusPayloadPluginArticles()(baseConfig())
    const articles = findArticles(config)

    const category = articles.fields.find(
      (field) => (field as { name?: string }).name === 'category',
    )
    expect(category).toMatchObject({
      type: 'relationship',
      relationTo: 'categories',
    })
    expect((category as { hasMany?: boolean }).hasMany).toBeUndefined()
    expect(
      (category as { admin?: { components?: { Field?: unknown } } }).admin?.components?.Field,
    ).toBe('@composius/payload-plugin-articles/client#CategoryFieldClient')
  })

  test('nested docs plugin wires breadcrumbs hooks and parent filterOptions', () => {
    const config = ComposiusPayloadPluginArticles()(baseConfig())
    const categories = findCategories(config)

    expect(categories.hooks?.beforeChange?.length).toBeGreaterThan(0)
    expect(categories.hooks?.afterChange?.length).toBeGreaterThan(0)
    const parent = categories.fields.find((field) => (field as { name?: string }).name === 'parent')
    expect((parent as { filterOptions?: unknown }).filterOptions).toBeDefined()
  })

  test('disabled keeps the nested docs fields but skips its hooks', () => {
    const config = ComposiusPayloadPluginArticles({ disabled: true })(baseConfig())
    const categories = findCategories(config)

    const fieldNames = categories.fields.map((field) => (field as { name?: string }).name)
    expect(fieldNames).toContain('parent')
    expect(fieldNames).toContain('breadcrumbs')
    expect(categories.hooks?.beforeChange ?? []).toHaveLength(0)
  })

  test('adds the SEO meta group and endpoints by default', () => {
    const config = ComposiusPayloadPluginArticles()(baseConfig())
    const articles = findArticles(config)

    const meta = articles.fields.find((field) => (field as { name?: string }).name === 'meta')
    expect(meta).toBeDefined()
    expect((meta as Field).type).toBe('group')
    expect(config.endpoints?.some((endpoint) => endpoint.path.includes('generate'))).toBe(true)
  })

  test('seo: false removes the meta group and skips the SEO plugin', () => {
    const config = ComposiusPayloadPluginArticles({ seo: false })(baseConfig())
    const articles = findArticles(config)

    const meta = articles.fields.find((field) => (field as { name?: string }).name === 'meta')
    expect(meta).toBeUndefined()
    expect(config.endpoints ?? []).toHaveLength(0)
  })

  test('disabled still registers the collection for schema consistency', () => {
    const config = ComposiusPayloadPluginArticles({ disabled: true })(baseConfig())
    findArticles(config)
    expect(config.endpoints ?? []).toHaveLength(0)
  })

  test('custom access overrides replace only the provided operations', () => {
    const create: Access = () => false
    const config = ComposiusPayloadPluginArticles({ access: { create } })(baseConfig())
    const articles = findArticles(config)

    expect(articles.access?.create).toBe(create)
    expect(articles.access?.read).toBe(authenticatedOrPublished)
  })

  test('categories default to public read and authenticated writes', () => {
    const config = ComposiusPayloadPluginArticles()(baseConfig())
    const categories = findCategories(config)

    expect(categories.access?.read).toBe(anyone)
    expect(categories.access?.create).toBe(authenticated)
    expect(categories.access?.update).toBe(authenticated)
    expect(categories.access?.delete).toBe(authenticated)
  })

  test('custom categoriesAccess overrides replace only the provided operations', () => {
    const read: Access = () => false
    const config = ComposiusPayloadPluginArticles({ categoriesAccess: { read } })(baseConfig())
    const categories = findCategories(config)

    expect(categories.access?.read).toBe(read)
    expect(categories.access?.create).toBe(authenticated)
  })

  test('custom articleUrl is used for admin previews', () => {
    const config = ComposiusPayloadPluginArticles({
      articleUrl: (slug) => `https://custom.dev/${slug}`,
    })(baseConfig())
    const articles = findArticles(config)

    const preview = articles.admin?.preview as (data: Record<string, unknown>) => string
    expect(preview({ slug: 'my-article' })).toBe('https://custom.dev/my-article')
  })

  test('authors are disabled by default', () => {
    const config = ComposiusPayloadPluginArticles()(baseConfig())

    expect(config.collections?.some((collection) => collection.slug === 'authors')).toBe(false)
    expect(findField(findArticles(config), 'author')).toBeUndefined()
  })

  test('authors: true adds the authors collection with the expected fields', () => {
    const config = ComposiusPayloadPluginArticles({ authors: true })(baseConfig())
    const authors = findAuthors(config)

    const fieldNames = authors.fields.map((field) => (field as { name?: string }).name)
    expect(fieldNames).toEqual(
      expect.arrayContaining(['name', 'picture', 'avatarPreview', 'contact', 'biography']),
    )
    expect(findField(authors, 'picture')).toMatchObject({ type: 'upload', relationTo: 'media' })
  })

  test('authors default to public read and authenticated writes', () => {
    const config = ComposiusPayloadPluginArticles({ authors: true })(baseConfig())
    const authors = findAuthors(config)

    expect(authors.access?.read).toBe(anyone)
    expect(authors.access?.create).toBe(authenticated)
    expect(authors.access?.update).toBe(authenticated)
    expect(authors.access?.delete).toBe(authenticated)
  })

  test('custom authorsAccess overrides replace only the provided operations', () => {
    const read: Access = () => false
    const config = ComposiusPayloadPluginArticles({ authors: true, authorsAccess: { read } })(
      baseConfig(),
    )
    const authors = findAuthors(config)

    expect(authors.access?.read).toBe(read)
    expect(authors.access?.create).toBe(authenticated)
  })

  test('articles get an editor relationship to users', () => {
    const config = ComposiusPayloadPluginArticles()(baseConfig())
    const articles = findArticles(config)

    expect(findField(articles, 'editor')).toMatchObject({
      type: 'relationship',
      relationTo: 'users',
    })
  })

  test('authors: true adds the author relationship on articles', () => {
    const config = ComposiusPayloadPluginArticles({ authors: true })(baseConfig())
    const articles = findArticles(config)

    expect(findField(articles, 'author')).toMatchObject({
      type: 'relationship',
      relationTo: 'authors',
    })
  })

  test('editor relationship uses a custom usersSlug', () => {
    const config = ComposiusPayloadPluginArticles({ usersSlug: 'staff' })(baseConfig())
    const articles = findArticles(config)

    expect(findField(articles, 'editor')).toMatchObject({ relationTo: 'staff' })
  })

  test('editor field update access defaults to any authenticated user', () => {
    const config = ComposiusPayloadPluginArticles()(baseConfig())
    const articles = findArticles(config)
    const editor = findField(articles, 'editor') as { access?: { update?: FieldAccess } }

    expect(editor.access?.update).toBe(authenticatedField)
    const fieldAccessArgs = (user: unknown) => ({ req: { user } }) as Parameters<FieldAccess>[0]
    expect(authenticatedField(fieldAccessArgs({ id: 1 }))).toBe(true)
    expect(authenticatedField(fieldAccessArgs(null))).toBe(false)
  })

  test('custom editorUpdateAccess overrides the editor field update access', () => {
    const editorUpdateAccess: FieldAccess = () => false
    const config = ComposiusPayloadPluginArticles({ editorUpdateAccess })(baseConfig())
    const articles = findArticles(config)
    const editor = findField(articles, 'editor') as { access?: { update?: FieldAccess } }

    expect(editor.access?.update).toBe(editorUpdateAccess)
  })

  test('editor defaults to the creating user only on create when unset', () => {
    const config = ComposiusPayloadPluginArticles()(baseConfig())
    const articles = findArticles(config)
    const editor = findField(articles, 'editor') as {
      hooks: { beforeChange: ((args: Record<string, unknown>) => unknown)[] }
    }
    const hook = editor.hooks.beforeChange[0]

    expect(hook({ operation: 'create', value: undefined, req: { user: { id: 7 } } })).toBe(7)
    // Keeps an explicit choice, and never overrides on update.
    expect(hook({ operation: 'create', value: 3, req: { user: { id: 7 } } })).toBe(3)
    expect(hook({ operation: 'update', value: undefined, req: { user: { id: 7 } } })).toBe(
      undefined,
    )
    expect(hook({ operation: 'create', value: undefined, req: {} })).toBe(undefined)
  })
})

describe('cache tags', () => {
  test('name the collection and the field addressing a document', () => {
    expect(ARTICLES_TAG).toBe('articles')
    expect(articleTag('hello-world')).toBe('articles:slug:hello-world')
    expect(articleIdTag(7)).toBe('articles:id:7')

    expect(CATEGORIES_TAG).toBe('categories')
    expect(categoryTag('news')).toBe('categories:slug:news')
    expect(categoryIdTag(3)).toBe('categories:id:3')

    expect(AUTHORS_TAG).toBe('authors')
    expect(authorIdTag(5)).toBe('authors:id:5')
  })
})

describe('revalidation', () => {
  const slugs = ['articles', 'authors', 'categories']

  // `afterChange` is shared with nestedDocsPlugin on categories, so `afterDelete`
  // is the hook that only revalidation ever adds.
  const revalidates = (config: Config, slug: string): boolean =>
    (findCollection(config, slug).hooks?.afterDelete?.length ?? 0) > 0

  test('every collection revalidates on change and on delete by default', () => {
    const config = ComposiusPayloadPluginArticles({ authors: true })(baseConfig())

    for (const slug of slugs) {
      expect(revalidates(config, slug)).toBe(true)
      expect(findCollection(config, slug).hooks?.afterChange).toBeDefined()
    }
  })

  test('revalidate: false leaves the collections without hooks', () => {
    const config = ComposiusPayloadPluginArticles({ authors: true, revalidate: false })(
      baseConfig(),
    )

    for (const slug of slugs) {
      expect(revalidates(config, slug)).toBe(false)
    }
    expect(findArticles(config).hooks?.afterChange).toBeUndefined()
  })

  test('a disabled plugin keeps its collections but stops revalidating', () => {
    const config = ComposiusPayloadPluginArticles({ disabled: true })(baseConfig())

    findArticles(config)
    expect(revalidates(config, 'articles')).toBe(false)
    expect(revalidates(config, 'categories')).toBe(false)
  })

  test('the categories breadcrumbs hooks survive alongside revalidation', () => {
    const categories = findCollection(ComposiusPayloadPluginArticles()(baseConfig()), 'categories')

    // nestedDocsPlugin's two afterChange hooks, plus the revalidation one.
    expect(categories.hooks?.afterChange).toHaveLength(3)
    expect(categories.hooks?.beforeChange).toHaveLength(1)
  })
})

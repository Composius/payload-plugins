import type { Access, CollectionConfig, Config, Field } from 'payload'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { authenticatedOrPublished, defaultPageUrl } from '../src/defaults.js'
import { ComposiusPayloadPluginPages, pageIdTag, pageTag, PAGES_TAG } from '../src/index.js'

const baseConfig = (): Config => ({ collections: [] }) as unknown as Config

const findPages = (config: Config): CollectionConfig => {
  const pages = config.collections?.find((collection) => collection.slug === 'pages')
  expect(pages).toBeDefined()
  return pages!
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('defaultPageUrl', () => {
  test('uses NEXT_PUBLIC_SERVER_URL when set', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://example.com')
    vi.stubEnv('SERVER_URL', 'https://ignored.com')
    expect(defaultPageUrl('my-page')).toBe('https://example.com/my-page')
  })

  test('falls back to SERVER_URL when NEXT_PUBLIC_SERVER_URL is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', '')
    vi.stubEnv('SERVER_URL', 'https://example.com')
    expect(defaultPageUrl('my-page')).toBe('https://example.com/my-page')
  })

  test('falls back to localhost and tolerates a missing slug', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', '')
    vi.stubEnv('SERVER_URL', '')
    expect(defaultPageUrl(null)).toBe('http://localhost:3000/')
  })
})

describe('ComposiusPayloadPluginPages', () => {
  test('adds the pages collection', () => {
    const config = ComposiusPayloadPluginPages()(baseConfig())
    const pages = findPages(config)

    expect(pages.versions).toMatchObject({ drafts: { autosave: true } })
    const fieldNames = pages.fields.map((field) => (field as { name?: string }).name)
    expect(fieldNames).toContain('title')
    expect(fieldNames).toContain('content')
  })

  test('adds the SEO meta group and endpoints by default', () => {
    const config = ComposiusPayloadPluginPages()(baseConfig())
    const pages = findPages(config)

    const meta = pages.fields.find((field) => (field as { name?: string }).name === 'meta')
    expect(meta).toBeDefined()
    expect((meta as Field).type).toBe('group')
    expect(config.endpoints?.some((endpoint) => endpoint.path.includes('generate'))).toBe(true)
  })

  test('seo: false removes the meta group and skips the SEO plugin', () => {
    const config = ComposiusPayloadPluginPages({ seo: false })(baseConfig())
    const pages = findPages(config)

    const meta = pages.fields.find((field) => (field as { name?: string }).name === 'meta')
    expect(meta).toBeUndefined()
    expect(config.endpoints ?? []).toHaveLength(0)
  })

  test('disabled still registers the collection for schema consistency', () => {
    const config = ComposiusPayloadPluginPages({ disabled: true })(baseConfig())
    findPages(config)
    expect(config.endpoints ?? []).toHaveLength(0)
  })

  test('custom access overrides replace only the provided operations', () => {
    const create: Access = () => false
    const config = ComposiusPayloadPluginPages({ access: { create } })(baseConfig())
    const pages = findPages(config)

    expect(pages.access?.create).toBe(create)
    expect(pages.access?.read).toBe(authenticatedOrPublished)
  })

  test('custom pageUrl is used for admin previews', () => {
    const config = ComposiusPayloadPluginPages({
      pageUrl: (slug) => `https://custom.dev/${slug}`,
    })(baseConfig())
    const pages = findPages(config)

    const preview = pages.admin?.preview as (data: Record<string, unknown>) => string
    expect(preview({ slug: 'my-page' })).toBe('https://custom.dev/my-page')
  })
})

describe('cache tags', () => {
  test('name the collection and the field addressing a document', () => {
    expect(PAGES_TAG).toBe('pages')
    expect(pageTag('about')).toBe('pages:slug:about')
    expect(pageIdTag(4)).toBe('pages:id:4')
  })
})

describe('revalidation', () => {
  test('pages revalidate on change and on delete by default', () => {
    const pages = findPages(ComposiusPayloadPluginPages()(baseConfig()))

    expect(pages.hooks?.afterChange).toHaveLength(1)
    expect(pages.hooks?.afterDelete).toHaveLength(1)
  })

  test('revalidate: false leaves the collection without hooks', () => {
    const pages = findPages(ComposiusPayloadPluginPages({ revalidate: false })(baseConfig()))

    expect(pages.hooks?.afterChange).toBeUndefined()
    expect(pages.hooks?.afterDelete).toBeUndefined()
  })

  test('a disabled plugin keeps its collection but stops revalidating', () => {
    const pages = findPages(ComposiusPayloadPluginPages({ disabled: true })(baseConfig()))

    expect(pages.hooks?.afterChange).toBeUndefined()
  })
})

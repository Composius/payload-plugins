import type { Access, CollectionConfig, Config, Field } from 'payload'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { authenticatedOrPublished, defaultPageUrl } from '../src/defaults.js'
import { VWPayloadPluginPages } from '../src/index.js'

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
    expect(defaultPageUrl('my-page')).toBe('https://example.com/my-page')
  })

  test('falls back to localhost and tolerates a missing slug', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', '')
    expect(defaultPageUrl(null)).toBe('http://localhost:3000/')
  })
})

describe('VWPayloadPluginPages', () => {
  test('adds the pages collection', () => {
    const config = VWPayloadPluginPages()(baseConfig())
    const pages = findPages(config)

    expect(pages.versions).toMatchObject({ drafts: { autosave: true } })
    const fieldNames = pages.fields.map((field) => (field as { name?: string }).name)
    expect(fieldNames).toContain('title')
    expect(fieldNames).toContain('content')
  })

  test('adds the SEO meta group and endpoints by default', () => {
    const config = VWPayloadPluginPages()(baseConfig())
    const pages = findPages(config)

    const meta = pages.fields.find((field) => (field as { name?: string }).name === 'meta')
    expect(meta).toBeDefined()
    expect((meta as Field).type).toBe('group')
    expect(config.endpoints?.some((endpoint) => endpoint.path.includes('generate'))).toBe(true)
  })

  test('seo: false removes the meta group and skips the SEO plugin', () => {
    const config = VWPayloadPluginPages({ seo: false })(baseConfig())
    const pages = findPages(config)

    const meta = pages.fields.find((field) => (field as { name?: string }).name === 'meta')
    expect(meta).toBeUndefined()
    expect(config.endpoints ?? []).toHaveLength(0)
  })

  test('disabled still registers the collection for schema consistency', () => {
    const config = VWPayloadPluginPages({ disabled: true })(baseConfig())
    findPages(config)
    expect(config.endpoints ?? []).toHaveLength(0)
  })

  test('custom access overrides replace only the provided operations', () => {
    const create: Access = () => false
    const config = VWPayloadPluginPages({ access: { create } })(baseConfig())
    const pages = findPages(config)

    expect(pages.access?.create).toBe(create)
    expect(pages.access?.read).toBe(authenticatedOrPublished)
  })

  test('custom pageUrl is used for admin previews', () => {
    const config = VWPayloadPluginPages({
      pageUrl: (slug) => `https://custom.dev/${slug}`,
    })(baseConfig())
    const pages = findPages(config)

    const preview = pages.admin?.preview as (data: Record<string, unknown>) => string
    expect(preview({ slug: 'my-page' })).toBe('https://custom.dev/my-page')
  })
})

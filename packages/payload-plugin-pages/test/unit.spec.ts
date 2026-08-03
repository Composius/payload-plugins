import type { Access, Block, BlocksField, CollectionConfig, Config, Field } from 'payload'
import type { GenerateDescription } from '@payloadcms/plugin-seo/types'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { authenticatedOrPublished, defaultGenerateDescription, defaultPageUrl } from '../src/defaults.js'
import {
  ComposiusPayloadPluginPages,
  contentBlock,
  CONTENT_BLOCK_SLUG,
  pageIdTag,
  pageTag,
  PAGES_TAG,
} from '../src/index.js'

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
    expect(fieldNames).toContain('publishedAt')
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

describe('layout blocks', () => {
  const hero: Block = { slug: 'hero', fields: [{ name: 'heading', type: 'text' }] }
  const cta: Block = { slug: 'cta', fields: [{ name: 'label', type: 'text' }] }

  const findLayout = (config: Config): BlocksField | undefined =>
    findPages(config).fields.find((field) => (field as { name?: string }).name === 'layout') as
      | BlocksField
      | undefined

  test('no layout field once nothing can go in it', () => {
    expect(
      findLayout(ComposiusPayloadPluginPages({ content: false })(baseConfig())),
    ).toBeUndefined()
  })

  test('blocks are defined inline on the layout field', () => {
    const layout = findLayout(
      ComposiusPayloadPluginPages({ blocks: [hero], content: false })(baseConfig()),
    )

    expect(layout?.type).toBe('blocks')
    expect(layout?.blocks).toEqual([hero])
    expect(layout?.blockReferences).toBeUndefined()
  })

  test('the layout field sits between content and publishedAt', () => {
    const pages = findPages(
      ComposiusPayloadPluginPages({ blocks: [hero], content: 'field' })(baseConfig()),
    )
    const names = pages.fields.map((field) => (field as { name?: string }).name)

    expect(names).toContain('content')
    expect(names.indexOf('layout')).toBeGreaterThan(names.indexOf('content'))
    expect(names.indexOf('layout')).toBeLessThan(names.indexOf('publishedAt'))
  })

  test('references are passed as blockReferences, which Payload requires to be alone', () => {
    const layout = findLayout(
      ComposiusPayloadPluginPages({ blockReferences: ['hero'], content: false })(baseConfig()),
    )

    expect(layout?.blockReferences).toEqual(['hero'])
    expect(layout?.blocks).toEqual([])
  })

  // A block object reachable only through `blockReferences` contributes nothing
  // to the import map — `generate:importmap` does not walk that list — so its
  // components go missing at runtime. Registered on the config, it is walked.
  test('inline blocks are registered on the config once references are in play', () => {
    const config = ComposiusPayloadPluginPages({
      blockReferences: ['hero'],
      blocks: [cta],
      content: false,
    })(baseConfig())

    expect(findLayout(config)?.blockReferences).toEqual(['hero', 'cta'])
    expect(config.blocks).toEqual([cta])
  })

  test('a block passed as a reference object is registered too', () => {
    const config = ComposiusPayloadPluginPages({
      blockReferences: ['hero', cta],
      content: false,
    })(baseConfig())

    expect(findLayout(config)?.blockReferences).toEqual(['hero', 'cta'])
    expect(config.blocks).toEqual([cta])
  })

  test('a slug the host already registered keeps their definition', () => {
    const theirs: Block = { slug: 'cta', fields: [{ name: 'theirs', type: 'text' }] }
    const config = baseConfig()
    config.blocks = [theirs]

    ComposiusPayloadPluginPages({ blockReferences: ['hero'], blocks: [cta], content: false })(config)

    expect(config.blocks).toEqual([theirs])
  })

  test('a disabled plugin keeps the layout field for schema consistency', () => {
    const layout = findLayout(
      ComposiusPayloadPluginPages({ blocks: [hero], content: false, disabled: true })(baseConfig()),
    )

    expect(layout?.blocks).toEqual([hero])
  })
})

describe('content', () => {
  const contentField = (config: Config) =>
    findPages(config).fields.find((field) => (field as { name?: string }).name === 'content')

  const layoutSlugs = (config: Config) => {
    const layout = findPages(config).fields.find(
      (field) => (field as { name?: string }).name === 'layout',
    ) as BlocksField | undefined

    return (layout?.blockReferences ?? layout?.blocks ?? []).map((block) =>
      typeof block === 'string' ? block : block.slug,
    )
  }

  test('the content block is in the layout by default, with nothing imported', () => {
    const config = ComposiusPayloadPluginPages()(baseConfig())

    expect(layoutSlugs(config)).toEqual([CONTENT_BLOCK_SLUG])
    expect(contentField(config)).toBeUndefined()
  })

  test('it leads the blocks the host passes', () => {
    const hero: Block = { slug: 'hero', fields: [] }
    const config = ComposiusPayloadPluginPages({ blocks: [hero] })(baseConfig())

    expect(layoutSlugs(config)).toEqual([CONTENT_BLOCK_SLUG, 'hero'])
  })

  test('and joins the references, registered on the config so the import map sees it', () => {
    const config = ComposiusPayloadPluginPages({ blockReferences: ['hero'] })(baseConfig())

    expect(layoutSlugs(config)).toEqual(['hero', CONTENT_BLOCK_SLUG])
    expect(config.blocks?.map((block) => block.slug)).toEqual([CONTENT_BLOCK_SLUG])
  })

  test("content: 'field' puts the richText on the document instead", () => {
    const config = ComposiusPayloadPluginPages({ content: 'field' })(baseConfig())

    expect((contentField(config) as Field)?.type).toBe('richText')
    expect(layoutSlugs(config)).toEqual([])
  })

  test('content: false leaves a page without prose of either kind', () => {
    const config = ComposiusPayloadPluginPages({ content: false })(baseConfig())

    expect(contentField(config)).toBeUndefined()
    expect(layoutSlugs(config)).toEqual([])
  })

  test('a block of the same slug replaces the built-in one', () => {
    const mine: Block = { slug: CONTENT_BLOCK_SLUG, fields: [{ name: 'body', type: 'text' }] }
    const config = ComposiusPayloadPluginPages({ blocks: [mine] })(baseConfig())
    const layout = findPages(config).fields.find(
      (field) => (field as { name?: string }).name === 'layout',
    ) as BlocksField

    expect(layout.blocks).toEqual([mine])
  })

  test('so does a reference to one, since the slug is taken', () => {
    const config = ComposiusPayloadPluginPages({ blockReferences: [CONTENT_BLOCK_SLUG] })(
      baseConfig(),
    )

    expect(layoutSlugs(config)).toEqual([CONTENT_BLOCK_SLUG])
  })

  test('the exported block carries the same richText field', () => {
    const block = contentBlock()

    expect(block.slug).toBe(CONTENT_BLOCK_SLUG)
    expect(block.fields).toHaveLength(1)
    expect(block.fields[0]).toMatchObject({ name: 'content', type: 'richText' })
  })

  test('each call returns its own block, since Payload sanitizes in place', () => {
    expect(contentBlock()).not.toBe(contentBlock())
  })
})

describe('defaultGenerateDescription', () => {
  const richText = (text: string) => ({
    root: { children: [{ children: [{ text, type: 'text' }], type: 'paragraph' }], type: 'root' },
  })

  const metaDescription = (doc: Record<string, unknown>) =>
    defaultGenerateDescription({ doc } as unknown as Parameters<GenerateDescription>[0])

  test('reads the content field when the collection has one', () => {
    expect(metaDescription({ content: richText('From the field') })).toBe('From the field')
  })

  test('falls back to the first content block of the layout', () => {
    expect(
      metaDescription({
        layout: [
          { blockType: 'hero', heading: 'Ignored' },
          { blockType: CONTENT_BLOCK_SLUG, content: richText('From the block') },
          { blockType: CONTENT_BLOCK_SLUG, content: richText('Later block') },
        ],
      }),
    ).toBe('From the block')
  })

  test('empty when a page has neither', () => {
    expect(metaDescription({ layout: [{ blockType: 'hero', heading: 'Just a hero' }] })).toBe('')
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

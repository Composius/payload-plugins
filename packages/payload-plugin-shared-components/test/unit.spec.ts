import type { Access } from 'payload'

import { describe, expect, test } from 'vitest'

import {
  authenticated,
  authenticatedOrPublished,
  BlockquoteButtonFeature,
  defaultGenerateDescription,
  defaultGenerateImage,
  defaultGenerateTitle,
  defaultGenerateURL,
  SEO_DESCRIPTION_MAX_LENGTH,
  seoField,
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

describe('SEO generate defaults', () => {
  test('generateTitle returns the document title or an empty string', () => {
    expect(defaultGenerateTitle(generateArgs({ title: 'Hello' }))).toBe('Hello')
    expect(defaultGenerateTitle(generateArgs({}))).toBe('')
  })

  test('generateDescription flattens rich text into plain text', () => {
    const doc = { content: richText('First paragraph.', 'Second paragraph.') }
    expect(defaultGenerateDescription(generateArgs(doc))).toBe(
      'First paragraph. Second paragraph.',
    )
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

  test('generateURL builds the URL from the document slug', () => {
    const generateURL = defaultGenerateURL((slug) => `https://example.com/a/${slug}`)
    expect(generateURL(generateArgs({ slug: 'my-doc' }))).toBe('https://example.com/a/my-doc')
  })
})

describe('seoField', () => {
  test('builds a sidebar meta group with the given labels', () => {
    const field = seoField({
      generators: {
        hasGenerateDescription: true,
        hasGenerateImage: true,
        hasGenerateTitle: true,
      },
      labels: { group: { en: 'SEO' }, title: { en: 'Title' } },
    })

    expect(field).toMatchObject({
      name: 'meta',
      type: 'group',
      admin: { position: 'sidebar' },
      label: { en: 'SEO' },
    })
  })
})

describe('block button features', () => {
  test('points the client feature at the given module path', async () => {
    const provider = BlockquoteButtonFeature('@example/my-plugin/client')
    const feature =
      typeof provider.feature === 'function'
        ? await provider.feature({} as never)
        : provider.feature

    expect(feature.ClientFeature).toBe('@example/my-plugin/client#BlockquoteButtonFeatureClient')
  })
})

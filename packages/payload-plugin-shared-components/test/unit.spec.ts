import type { Access } from 'payload'

import { describe, expect, test } from 'vitest'

import {
  anyone,
  authenticated,
  authenticatedOrPublished,
  BlockquoteButtonFeature,
  defaultGenerateDescription,
  defaultGenerateImage,
  defaultGenerateTitle,
  defaultGenerateURL,
  SEO_DESCRIPTION_MAX_LENGTH,
  seoField,
  slugify,
  slugifyValue,
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
  test('anyone allows every request', () => {
    expect(anyone(accessArgs({ id: 1 }))).toBe(true)
    expect(anyone(accessArgs(null))).toBe(true)
  })

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

  test('generateDescription truncates to the SEO limit with an ellipsis', () => {
    const doc = { content: richText('a'.repeat(500)) }
    const description = defaultGenerateDescription(generateArgs(doc)) as string
    expect(description).toHaveLength(SEO_DESCRIPTION_MAX_LENGTH)
    expect(description.endsWith('...')).toBe(true)
  })

  test('generateDescription does not add an ellipsis when within the limit', () => {
    const doc = { content: richText('Short description.') }
    expect(defaultGenerateDescription(generateArgs(doc))).toBe('Short description.')
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

describe('slugify', () => {
  test('keeps the letter when removing diacritics', () => {
    expect(slugifyValue('nouveautés')).toBe('nouveautes')
    expect(slugifyValue('Crème Brûlée')).toBe('creme-brulee')
    expect(slugifyValue('Über Straße')).toBe('uber-strasse')
    expect(slugifyValue('København møde')).toBe('kobenhavn-mode')
    expect(slugifyValue('Łódź żółw')).toBe('lodz-zolw')
  })

  test('lowercases, joins words with dashes and drops punctuation', () => {
    expect(slugifyValue('  Hello  World! ')).toBe('hello-world')
    expect(slugifyValue('Español: ¿Qué?')).toBe('espanol-que')
    expect(slugifyValue('my_snake_case')).toBe('my_snake_case')
  })

  test('passes empty values through', () => {
    expect(slugifyValue('')).toBe('')
    expect(slugifyValue(undefined)).toBeUndefined()
  })

  test('slugifies the value handed over by the slug field', () => {
    const args = { valueToSlugify: 'Nouveautés' } as Parameters<typeof slugify>[0]
    expect(slugify(args)).toBe('nouveautes')
    expect(slugify({ ...args, valueToSlugify: 42 })).toBeUndefined()
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

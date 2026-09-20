import type { Payload } from 'payload'

import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import config from './config.js'

let payload: Payload

/** A lexical feature of the content block's richText field, as the editor resolved it. */
const contentEditorFeature = (key: string): unknown => {
  const block = payload.config.blocks?.find(({ slug }) => slug === 'content')
  const content = block?.fields.find((field) => 'name' in field && field.name === 'content') as {
    editor: { editorConfig: { resolvedFeatureMap: Map<string, unknown> } }
  }

  return content.editor.editorConfig.resolvedFeatureMap.get(key)
}

afterAll(async () => {
  await payload.destroy()
})

beforeAll(async () => {
  payload = await getPayload({ config })
})

describe('Plugin integration tests', () => {
  test('plugin adds the pages collection', () => {
    expect(payload.collections['pages']).toBeDefined()
  })

  test('can create a page', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: {
        slug: 'hello-world',
        publishedAt: new Date().toISOString(),
        title: 'Hello World',
      },
    })

    expect(page.title).toBe('Hello World')
    expect(page.slug).toBe('hello-world')
  })

  test('a page is laid out with referenced, inline and content blocks', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: {
        slug: 'with-layout',
        layout: [
          { blockType: 'hero', heading: 'Welcome' },
          { blockType: 'content' },
          { blockType: 'callToAction', href: '/contact', label: 'Say hi' },
        ],
        title: 'With Layout',
      },
    })

    expect(page.layout).toHaveLength(3)
    expect(page.layout?.[0]).toMatchObject({ blockType: 'hero', heading: 'Welcome' })
    expect(page.layout?.[1]).toMatchObject({ blockType: 'content' })
    expect(page.layout?.[2]).toMatchObject({ blockType: 'callToAction', label: 'Say hi' })
  })

  test("the content block's editor carries the font size control, pointing at this plugin", () => {
    expect(contentEditorFeature('editorFontSize')).toMatchObject({
      ClientFeature: '@composius/payload-plugin-pages/client#EditorFontSizeFeatureClient',
      clientFeatureProps: { defaultSize: 'normal' },
    })
  })

  // The articles suite turns `emphasizeEditorLinks` on; this one leaves it at
  // its default, so the links stay as Payload draws them.
  test('links are left as Payload draws them unless the option asks otherwise', () => {
    expect(contentEditorFeature('editorLinkEmphasis')).toBeUndefined()
  })

  test('prose lives in the content block, not on the document', () => {
    expect(payload.collections['pages']?.config.fields).not.toContainEqual(
      expect.objectContaining({ name: 'content' }),
    )
  })

  // The revalidation hooks run inside the write's transaction, and there is no
  // Next.js request scope here to revalidate against. Every write below must
  // still go through: a cache that cannot be reached is not a failed write.
  test('publishing and deleting survive without a Next.js runtime', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: { slug: 'cached', _status: 'published', title: 'Cached' },
    })

    const renamed = await payload.update({
      id: page.id,
      collection: 'pages',
      data: { slug: 'cached-renamed' },
    })
    expect(renamed.slug).toBe('cached-renamed')

    await payload.delete({ id: page.id, collection: 'pages' })

    const remaining = await payload.find({
      collection: 'pages',
      where: { slug: { equals: 'cached-renamed' } },
    })
    expect(remaining.totalDocs).toBe(0)
  })
})

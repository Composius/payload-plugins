import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  fetchVideoTitle,
  fillVideoEmbedTitles,
  parseVideoEmbedUrl,
} from '../src/index.js'

const YOUTUBE = 'https://youtu.be/dQw4w9WgXcQ'
const VIMEO = 'https://vimeo.com/1084537'
const GANJING = 'https://www.ganjingworld.com/video/1iohfkf8c8f5zzNmutaPaCUsi1rj1c'

const video = (url: string) => parseVideoEmbedUrl(url)!

const json = (body: unknown) => ({ json: () => Promise.resolve(body), ok: true }) as Response

const html = (body: string) => ({ ok: true, text: () => Promise.resolve(body) }) as Response

const stubFetch = (handler: (url: string) => Promise<Response> | Response) =>
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => Promise.resolve(handler(String(input)))),
  )

const fetchCalls = () => (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls

afterEach(() => {
  vi.unstubAllGlobals()
})

/** A lexical tree holding one video block per link. */
const content = (...blocks: Record<string, unknown>[]) => ({
  root: {
    type: 'root',
    children: blocks.map((fields) => ({
      type: 'block',
      fields: { blockType: 'videoEmbed', ...fields },
      version: 2,
    })),
  },
})

const fill = async (value: unknown, previousValue?: unknown) =>
  (await fillVideoEmbedTitles({ previousValue, value } as never)) as ReturnType<typeof content>

const fieldsOf = (tree: ReturnType<typeof content>, index = 0) =>
  tree.root.children[index].fields as Record<string, unknown>

describe('fetchVideoTitle', () => {
  test('asks YouTube for the watch link, which is the only one its oEmbed answers', async () => {
    stubFetch(() => json({ title: 'Never Gonna Give You Up' }))

    expect(await fetchVideoTitle(video(YOUTUBE))).toBe('Never Gonna Give You Up')
    expect(String(fetchCalls()[0]?.[0])).toBe(
      'https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ',
    )
  })

  test('asks Vimeo for the player link, so an unlisted hash comes along', async () => {
    stubFetch(() => json({ title: 'Big Buck Bunny' }))

    expect(await fetchVideoTitle(video('https://vimeo.com/1084537/8272103f6e'))).toBe(
      'Big Buck Bunny',
    )
    expect(String(fetchCalls()[0]?.[0])).toContain(
      encodeURIComponent('https://player.vimeo.com/video/1084537?h=8272103f6e'),
    )
  })

  test('reads og:title off the Gan Jing World page, which has no oEmbed', async () => {
    stubFetch(() =>
      html('<head><meta content="Tea &amp; Sympathy" property="og:title"/><title>x</title></head>'),
    )

    expect(await fetchVideoTitle(video(GANJING))).toBe('Tea & Sympathy')
    expect(String(fetchCalls()[0]?.[0])).toBe(
      'https://www.ganjingworld.com/video/1iohfkf8c8f5zzNmutaPaCUsi1rj1c',
    )
  })

  test('decodes numeric entities in a scraped title', async () => {
    stubFetch(() => html('<meta property="og:title" content="L&#39;histoire &#x2014; 1"/>'))

    expect(await fetchVideoTitle(video(GANJING))).toBe("L'histoire — 1")
  })

  test('null when the provider has no title to give', async () => {
    stubFetch(() => json({}))
    expect(await fetchVideoTitle(video(YOUTUBE))).toBeNull()

    stubFetch(() => ({ ok: false, status: 404 }) as Response)
    expect(await fetchVideoTitle(video(YOUTUBE))).toBeNull()

    stubFetch(() => html('<head><title>No og:title here</title></head>'))
    expect(await fetchVideoTitle(video(GANJING))).toBeNull()
  })

  test('a failing request is swallowed — a title never costs a save', async () => {
    stubFetch(() => {
      throw new Error('network down')
    })

    await expect(fetchVideoTitle(video(YOUTUBE))).resolves.toBeNull()
  })
})

describe('fillVideoEmbedTitles', () => {
  test('fills the title of a newly added video', async () => {
    stubFetch(() => json({ title: 'Never Gonna Give You Up' }))

    const filled = await fill(content({ url: YOUTUBE }))

    expect(fieldsOf(filled)).toMatchObject({ title: 'Never Gonna Give You Up', url: YOUTUBE })
    expect(fieldsOf(filled).titleUnavailable).toBeUndefined()
  })

  test('marks a link the provider would not resolve, and keeps no title', async () => {
    stubFetch(() => ({ ok: false, status: 404 }) as Response)

    const filled = await fill(content({ url: YOUTUBE }))

    expect(fieldsOf(filled).title).toBeUndefined()
    expect(fieldsOf(filled).titleUnavailable).toBe(true)
  })

  test('a link the last save already resolved is not looked up again', async () => {
    stubFetch(() => json({ title: 'Refetched' }))

    const filled = await fill(
      content({ title: 'From before', url: YOUTUBE }),
      content({ title: 'From before', url: YOUTUBE }),
    )

    expect(fieldsOf(filled).title).toBe('From before')
    expect(fetchCalls()).toHaveLength(0)
  })

  test('nor is one that came back empty before — a dead link is asked once', async () => {
    stubFetch(() => json({ title: 'Alive again' }))

    const filled = await fill(
      content({ titleUnavailable: true, url: YOUTUBE }),
      content({ titleUnavailable: true, url: YOUTUBE }),
    )

    expect(fieldsOf(filled).titleUnavailable).toBe(true)
    expect(fetchCalls()).toHaveLength(0)
  })

  test('editing the link asks again, and the stale title goes', async () => {
    stubFetch(() => json({ title: 'Big Buck Bunny' }))

    const filled = await fill(
      content({ title: 'Never Gonna Give You Up', url: VIMEO }),
      content({ title: 'Never Gonna Give You Up', url: YOUTUBE }),
    )

    expect(fieldsOf(filled).title).toBe('Big Buck Bunny')
    expect(fetchCalls()).toHaveLength(1)
  })

  test('one lookup serves every block pointing at the same video', async () => {
    stubFetch(() => json({ title: 'Never Gonna Give You Up' }))

    const filled = await fill(content({ url: YOUTUBE }, { url: YOUTUBE }))

    expect(fieldsOf(filled, 1).title).toBe('Never Gonna Give You Up')
    expect(fetchCalls()).toHaveLength(1)
  })

  test('an unsupported or empty link carries no title at all', async () => {
    stubFetch(() => json({ title: 'Should not be asked' }))

    const filled = await fill(content({ title: 'Stale', url: 'https://example.com/nope' }, {}))

    expect(fieldsOf(filled).title).toBeUndefined()
    expect(fieldsOf(filled).titleUnavailable).toBeUndefined()
    expect(fieldsOf(filled, 1).title).toBeUndefined()
    expect(fetchCalls()).toHaveLength(0)
  })

  test('reaches a video nested in the rich text of another block', async () => {
    stubFetch(() => json({ title: 'Nested' }))

    const nested = {
      root: {
        type: 'root',
        children: [
          {
            type: 'block',
            fields: { blockType: 'callout', body: content({ url: YOUTUBE }) },
          },
        ],
      },
    }

    const filled = (await fillVideoEmbedTitles({ value: nested } as never)) as typeof nested
    const inner = filled.root.children[0].fields.body

    expect(fieldsOf(inner).title).toBe('Nested')
  })

  test('rich text without a video block is handed back untouched, unasked', async () => {
    stubFetch(() => json({ title: 'Should not be asked' }))

    const paragraphs = { root: { type: 'root', children: [{ type: 'paragraph', children: [] }] } }

    expect(await fillVideoEmbedTitles({ value: paragraphs } as never)).toBe(paragraphs)
    expect(fetchCalls()).toHaveLength(0)
  })
})

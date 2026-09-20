import type { Block, TextField, TextFieldSingleValidation } from 'payload'

import { describe, expect, test } from 'vitest'

import {
  contentEditorFeatures,
  parseVideoEmbedUrl,
  VIDEO_EMBED_BLOCK_SLUG,
  videoEmbedBlock,
} from '../src/index.js'

const urlField = (block: Block): TextField => block.fields[0] as TextField

const validate = (value: unknown, language?: string) => {
  const field = urlField(videoEmbedBlock('@example/my-plugin/client'))
  const args = { req: { i18n: { language } } } as unknown as Parameters<
    TextFieldSingleValidation
  >[1]

  return (field.validate as TextFieldSingleValidation)(value as string, args)
}

describe('parseVideoEmbedUrl', () => {
  test('reads the id out of every shape a YouTube link comes in', () => {
    const embedUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ'

    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?t=42',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
      'youtube.com/watch?v=dQw4w9WgXcQ',
    ]) {
      expect(parseVideoEmbedUrl(url)).toEqual({
        id: 'dQw4w9WgXcQ',
        embedUrl,
        provider: 'youtube',
      })
    }
  })

  test('rejects a YouTube link without a well-formed id', () => {
    expect(parseVideoEmbedUrl('https://www.youtube.com/watch?v=tooshort')).toBeNull()
    expect(parseVideoEmbedUrl('https://www.youtube.com/@a-channel')).toBeNull()
    expect(parseVideoEmbedUrl('https://www.youtube.com/')).toBeNull()
  })

  test('reads Vimeo links, including the ones nested under a channel or a group', () => {
    const expected = {
      id: '76979871',
      embedUrl: 'https://player.vimeo.com/video/76979871',
      provider: 'vimeo',
    }

    expect(parseVideoEmbedUrl('https://vimeo.com/76979871')).toEqual(expected)
    expect(parseVideoEmbedUrl('https://player.vimeo.com/video/76979871')).toEqual(expected)
    expect(parseVideoEmbedUrl('https://vimeo.com/channels/staffpicks/76979871')).toEqual(expected)
    expect(parseVideoEmbedUrl('https://vimeo.com/groups/motion/videos/76979871')).toEqual(expected)
    expect(parseVideoEmbedUrl('https://vimeo.com/album/2222222/video/76979871')).toEqual(expected)
  })

  test('keeps the hash an unlisted Vimeo video needs to play', () => {
    const embedUrl = 'https://player.vimeo.com/video/76979871?h=8272103f6e'

    expect(parseVideoEmbedUrl('https://vimeo.com/76979871/8272103f6e')?.embedUrl).toBe(embedUrl)
    expect(parseVideoEmbedUrl('https://player.vimeo.com/video/76979871?h=8272103f6e')?.embedUrl).toBe(
      embedUrl,
    )
  })

  test('reads Gan Jing World links, on either of its domains', () => {
    const id = '1iohfkf8c8f5zzNmutaPaCUsi1rj1c'
    const expected = {
      id,
      embedUrl: `https://www.ganjingworld.com/embed/${id}`,
      provider: 'ganjingWorld',
    }

    expect(parseVideoEmbedUrl(`https://www.ganjingworld.com/video/${id}`)).toEqual(expected)
    expect(parseVideoEmbedUrl(`https://www.ganjingworld.com/zh-TW/video/${id}`)).toEqual(expected)
    expect(parseVideoEmbedUrl(`https://www.ganjingworld.com/embed/${id}`)).toEqual(expected)
    expect(parseVideoEmbedUrl(`https://www.ganjing.com/video/${id}`)).toEqual(expected)
  })

  test('rejects anything that is not a video link of a supported provider', () => {
    expect(parseVideoEmbedUrl('https://example.com/video/123')).toBeNull()
    expect(parseVideoEmbedUrl('https://www.ganjingworld.com/channel/1abc')).toBeNull()
    expect(parseVideoEmbedUrl('not a url')).toBeNull()
    expect(parseVideoEmbedUrl('')).toBeNull()
  })

  test('rejects a scheme that is not http(s)', () => {
    expect(parseVideoEmbedUrl('javascript:alert(1)')).toBeNull()
    expect(parseVideoEmbedUrl('ftp://youtu.be/dQw4w9WgXcQ')).toBeNull()
  })

  test('a lookalike host does not pass for the real one', () => {
    expect(parseVideoEmbedUrl('https://notyoutube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(parseVideoEmbedUrl('https://evil-vimeo.com/76979871')).toBeNull()
  })
})

describe('videoEmbedBlock', () => {
  test('takes the link, and carries the title the save fills in', () => {
    const block = videoEmbedBlock('@example/my-plugin/client')
    const [url, title, unavailable] = block.fields as { admin?: unknown; name?: string }[]

    expect(block.slug).toBe(VIDEO_EMBED_BLOCK_SLUG)
    expect(urlField(block)).toMatchObject({ name: 'url', type: 'text', required: true })
    expect(title).toMatchObject({ name: 'title', type: 'text', admin: { readOnly: true } })
    expect(unavailable).toMatchObject({ name: 'titleUnavailable', admin: { hidden: true } })
    expect(url?.name).toBe('url')
  })

  test('the title field points at the given client module', () => {
    const [, title] = videoEmbedBlock('@example/my-plugin/client').fields as {
      admin?: { components?: { Field?: string } }
    }[]

    expect(title?.admin?.components?.Field).toBe('@example/my-plugin/client#VideoEmbedTitleField')
  })

  test('each call returns its own block, since Payload sanitizes in place', () => {
    expect(videoEmbedBlock('@example/my-plugin/client')).not.toBe(videoEmbedBlock('@example/my-plugin/client'))
  })

  test('the url field accepts a supported link and rejects the rest', () => {
    expect(validate('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
    expect(validate('https://example.com/video.mp4')).toBe(
      'Enter the link of a YouTube, Vimeo or Gan Jing World video',
    )
  })

  test('the error message follows the language of the request', () => {
    expect(validate('https://example.com', 'fr')).toBe(
      'Saisissez le lien d’une vidéo YouTube, Vimeo ou Gan Jing World',
    )
  })

  test('an empty value is left to `required` to report', () => {
    expect(validate('')).toBe(true)
    expect(validate(undefined)).toBe(true)
  })
})

describe('contentEditorFeatures', () => {
  test('carries the video block, on top of the default features', () => {
    const features = contentEditorFeatures('@example/my-plugin/client') as (
      args: never,
    ) => { key: string; serverFeatureProps?: { blocks?: Block[] } }[]

    const provided = features({ defaultFeatures: [] } as never)

    const blocks = provided.find(({ key }) => key === 'blocks')?.serverFeatureProps?.blocks

    expect(blocks?.map((block) => block.slug)).toEqual([VIDEO_EMBED_BLOCK_SLUG])
  })
})

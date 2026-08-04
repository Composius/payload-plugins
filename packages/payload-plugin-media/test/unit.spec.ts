import type {
  Access,
  CollectionBeforeOperationHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  Config,
} from 'payload'

import { describe, expect, test } from 'vitest'

import { anyone, authenticated, defaultImageSizes } from '../src/defaults.js'
import {
  buildPrefix,
  convertToWebp,
  uniqueFilename,
  ComposiusPayloadPluginMedia,
} from '../src/index.js'

const accessArgs = (user: unknown) => ({ req: { user } }) as Parameters<Access>[0]

const baseConfig = (): Config => ({ collections: [] }) as unknown as Config

const findMedia = (config: Config): CollectionConfig => {
  const media = config.collections?.find((collection) => collection.slug === 'media')
  expect(media).toBeDefined()
  return media!
}

const upload = (media: CollectionConfig) =>
  media.upload as Exclude<CollectionConfig['upload'], boolean | undefined>

describe('access defaults', () => {
  test('anyone always allows', () => {
    expect(anyone(accessArgs(null))).toBe(true)
    expect(anyone(accessArgs({ id: 1 }))).toBe(true)
  })

  test('authenticated allows only requests with a user', () => {
    expect(authenticated(accessArgs({ id: 1 }))).toBe(true)
    expect(authenticated(accessArgs(null))).toBe(false)
  })
})

describe('buildPrefix', () => {
  const now = new Date(2026, 6, 9) // 2026-07-09

  test('a string prefix is used as-is', () => {
    expect(buildPrefix('uploads/site', now)).toBe('uploads/site')
  })

  test('defaults to <folder>/<year>/<month>', () => {
    expect(buildPrefix({ folder: 'site' }, now)).toBe('site/2026/07')
  })

  test('year and month without a folder', () => {
    expect(buildPrefix({}, now)).toBe('2026/07')
  })

  test('day can be enabled', () => {
    expect(buildPrefix({ day: true, folder: 'site' }, now)).toBe('site/2026/07/09')
  })

  test('parts can be disabled', () => {
    expect(buildPrefix({ folder: 'site', month: false, year: false }, now)).toBe('site')
  })
})

describe('uniqueFilename', () => {
  test('appends a random hex suffix before the extension', () => {
    expect(uniqueFilename('photo.png')).toMatch(/^photo-[0-9a-f]{8}\.png$/)
  })

  test('two calls produce different names', () => {
    expect(uniqueFilename('photo.png')).not.toBe(uniqueFilename('photo.png'))
  })
})

describe('convertToWebp', () => {
  const webpData = Buffer.from('webp-bytes')

  /** Minimal stub of the sharp chain used by the hook. */
  const sharpStub = () => {
    const calls: { animated?: boolean; input: unknown; quality?: number }[] = []

    const sharp = (input: unknown, options?: { animated?: boolean }) => ({
      rotate: () => ({
        webp: (webpOptions?: { quality?: number }) => {
          calls.push({ animated: options?.animated, input, quality: webpOptions?.quality })
          return { toBuffer: async () => webpData }
        },
      }),
    })

    return { calls, sharp }
  }

  const file = (overrides: Partial<{ data: Buffer; mimetype: string; name: string }> = {}) => ({
    data: Buffer.from('original-bytes'),
    mimetype: 'image/png',
    name: 'photo.png',
    size: 14,
    ...overrides,
  })

  const hookArgs = (uploaded: unknown, sharp: unknown) =>
    ({
      operation: 'create',
      req: { file: uploaded, payload: { config: { sharp } } },
    }) as unknown as Parameters<CollectionBeforeOperationHook>[0]

  test('converts a PNG upload to WebP in place', async () => {
    const { calls, sharp } = sharpStub()
    const uploaded = file()

    await convertToWebp(hookArgs(uploaded, sharp))

    expect(uploaded).toMatchObject({
      data: webpData,
      mimetype: 'image/webp',
      name: 'photo.webp',
      size: webpData.length,
    })
    expect(calls).toEqual([{ animated: false, input: Buffer.from('original-bytes'), quality: 90 }])
  })

  test('leaves AVIF uploads untouched', async () => {
    const { calls, sharp } = sharpStub()
    const uploaded = file({ mimetype: 'image/avif', name: 'photo.avif' })

    await convertToWebp(hookArgs(uploaded, sharp))

    expect(uploaded).toMatchObject({ mimetype: 'image/avif', name: 'photo.avif' })
    expect(calls).toHaveLength(0)
  })

  test('leaves formats sharp cannot re-encode untouched', async () => {
    const { calls, sharp } = sharpStub()
    const uploaded = file({ mimetype: 'image/svg+xml', name: 'logo.svg' })

    await convertToWebp(hookArgs(uploaded, sharp))

    expect(uploaded).toMatchObject({ mimetype: 'image/svg+xml', name: 'logo.svg' })
    expect(calls).toHaveLength(0)
  })

  test('re-encoding a WebP upload is skipped', async () => {
    const { calls, sharp } = sharpStub()

    await convertToWebp(hookArgs(file({ mimetype: 'image/webp', name: 'photo.webp' }), sharp))

    expect(calls).toHaveLength(0)
  })

  test('animated GIFs keep their frames', async () => {
    const { calls, sharp } = sharpStub()

    await convertToWebp(hookArgs(file({ mimetype: 'image/gif', name: 'loop.gif' }), sharp))

    expect(calls[0]?.animated).toBe(true)
  })

  test('no-op without a file or without sharp configured', async () => {
    const { sharp } = sharpStub()
    const uploaded = file()

    await convertToWebp(hookArgs(undefined, sharp))
    await convertToWebp(hookArgs(uploaded, undefined))

    expect(uploaded).toMatchObject({ mimetype: 'image/png', name: 'photo.png' })
  })
})

describe('ComposiusPayloadPluginMedia', () => {
  test('adds the media upload collection', () => {
    const config = ComposiusPayloadPluginMedia()(baseConfig())
    const media = findMedia(config)

    const fieldNames = media.fields.map((field) => (field as { name?: string }).name)
    expect(fieldNames).toContain('alt')

    expect(upload(media)).toMatchObject({
      adminThumbnail: 'thumbnail',
      imageSizes: defaultImageSizes,
      mimeTypes: ['image/*'],
      resizeOptions: { width: 2560, withoutEnlargement: true },
    })

    // The conversion is done by the beforeOperation hook, not by
    // formatOptions, which would also transcode AVIF
    expect(upload(media).formatOptions).toBeUndefined()
  })

  test('custom image sizes replace the defaults', () => {
    const imageSizes = [{ name: 'hero', width: 1920 }]
    const config = ComposiusPayloadPluginMedia({ imageSizes })(baseConfig())

    expect(upload(findMedia(config))).toMatchObject({
      adminThumbnail: 'hero',
      imageSizes,
    })
  })

  test('default access: read is public, writes require a user', () => {
    const config = ComposiusPayloadPluginMedia()(baseConfig())
    const media = findMedia(config)

    expect(media.access?.read).toBe(anyone)
    expect(media.access?.create).toBe(authenticated)
    expect(media.access?.update).toBe(authenticated)
    expect(media.access?.delete).toBe(authenticated)
  })

  test('custom access overrides replace only the provided operations', () => {
    const create: Access = () => false
    const config = ComposiusPayloadPluginMedia({ access: { create } })(baseConfig())
    const media = findMedia(config)

    expect(media.access?.create).toBe(create)
    expect(media.access?.read).toBe(anyone)
  })

  test('renames uploaded files on create by default', () => {
    const config = ComposiusPayloadPluginMedia()(baseConfig())
    const [, hook] = findMedia(config).hooks?.beforeOperation ?? []
    expect(hook).toBeDefined()

    const req = { file: { name: 'photo.png' } }
    hook!({ operation: 'create', req } as Parameters<CollectionBeforeOperationHook>[0])
    expect(req.file.name).toMatch(/^photo-[0-9a-f]{8}\.png$/)

    const untouched = { file: { name: 'photo.png' } }
    hook!({ operation: 'read', req: untouched } as Parameters<CollectionBeforeOperationHook>[0])
    expect(untouched.file.name).toBe('photo.png')
  })

  test('randomSuffix: false leaves only the WebP conversion hook', () => {
    const config = ComposiusPayloadPluginMedia({ randomSuffix: false })(baseConfig())
    expect(findMedia(config).hooks?.beforeOperation).toEqual([convertToWebp])
  })

  test('prefix option sets data.prefix on create', () => {
    const config = ComposiusPayloadPluginMedia({ prefix: 'uploads/site' })(baseConfig())
    const [hook] = findMedia(config).hooks?.beforeValidate ?? []
    expect(hook).toBeDefined()

    const data: { prefix?: string } = {}
    hook!({ data, operation: 'create' } as Parameters<CollectionBeforeValidateHook>[0])
    expect(data.prefix).toBe('uploads/site')

    const update: { prefix?: string } = {}
    hook!({ data: update, operation: 'update' } as Parameters<CollectionBeforeValidateHook>[0])
    expect(update.prefix).toBeUndefined()
  })

  test('no prefix option means no prefix hook', () => {
    const config = ComposiusPayloadPluginMedia()(baseConfig())
    expect(findMedia(config).hooks?.beforeValidate).toBeUndefined()
  })

  test('disabled still registers the collection for schema consistency', () => {
    const config = ComposiusPayloadPluginMedia({ disabled: true })(baseConfig())
    findMedia(config)
  })
})

import type {
  Access,
  CollectionBeforeOperationHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  Config,
} from 'payload'

import { describe, expect, test } from 'vitest'

import { anyone, authenticated, defaultImageSizes, defaultMimeTypes } from '../src/defaults.js'
import {
  buildPrefix,
  convertAvifToWebp,
  enforceMaxFileSize,
  uniqueFilename,
  withWebpSizes,
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

describe('enforceMaxFileSize', () => {
  const hook = enforceMaxFileSize(1000)

  const hookArgs = (file: unknown, language = 'en') =>
    ({ operation: 'create', req: { file, i18n: { language } } }) as unknown as Parameters<
      CollectionBeforeOperationHook
    >[0]

  test('a file within the limit passes', () => {
    expect(() => hook(hookArgs({ name: 'photo.jpg', size: 1000 }))).not.toThrow()
  })

  test('an oversized file is rejected with the limit in the message', () => {
    expect(() => hook(hookArgs({ name: 'photo.jpg', size: 1001 }))).toThrow(
      /maximum upload size is 1000 bytes/,
    )
  })

  test('the limit is reported in a readable unit', () => {
    expect(() => enforceMaxFileSize(5 * 1024 * 1024)(hookArgs({ size: 6_000_000 }))).toThrow(/5 MB/)
    expect(() => enforceMaxFileSize(512_000)(hookArgs({ size: 600_000 }))).toThrow(/500 KB/)
  })

  test('the message follows the request language', () => {
    expect(() => hook(hookArgs({ name: 'photo.jpg', size: 1001 }, 'fr'))).toThrow(
      /trop volumineux/,
    )
  })

  test('a file truncated by the app-wide limit is rejected', () => {
    // Payload truncates instead of failing unless `abortOnLimit` is set, which
    // leaves the file sitting exactly on the limit
    expect(() => hook(hookArgs({ name: 'photo.jpg', size: 1000, truncated: true }))).toThrow()
  })

  test('operations without a file pass', () => {
    expect(() => hook(hookArgs(undefined))).not.toThrow()
  })
})

describe('convertAvifToWebp', () => {
  const webpData = Buffer.from('webp-bytes')

  type SharpCall = { effort?: number; input: unknown; quality?: number; resize?: unknown }

  /** Minimal stub of the sharp chain used by the hook. */
  const sharpStub = () => {
    const calls: SharpCall[] = []

    const sharp = (input: unknown) => {
      const call: SharpCall = { input }

      const chain = {
        resize: (resizeOptions: unknown) => {
          call.resize = resizeOptions
          return chain
        },
        rotate: () => chain,
        toBuffer: async () => webpData,
        webp: (webpOptions?: { effort?: number; quality?: number }) => {
          calls.push({ ...call, ...webpOptions })
          return chain
        },
      }

      return chain
    }

    return { calls, sharp }
  }

  const file = (overrides: Partial<{ mimetype: string; name: string }> = {}) => ({
    data: Buffer.from('avif-bytes'),
    mimetype: 'image/avif',
    name: 'photo.avif',
    size: 10,
    ...overrides,
  })

  const hookArgs = (uploaded: unknown, sharp: unknown, query: unknown = {}) =>
    ({
      operation: 'create',
      req: { file: uploaded, payload: { config: { sharp } }, query },
    }) as unknown as Parameters<CollectionBeforeOperationHook>[0]

  test('converts an AVIF upload to WebP in place', async () => {
    const { calls, sharp } = sharpStub()
    const uploaded = file()

    await convertAvifToWebp(hookArgs(uploaded, sharp))

    expect(uploaded).toMatchObject({
      data: webpData,
      mimetype: 'image/webp',
      name: 'photo.webp',
      size: webpData.length,
    })
    expect(calls).toEqual([
      {
        effort: 0,
        input: Buffer.from('avif-bytes'),
        quality: 90,
        resize: { width: 2560, withoutEnlargement: true },
      },
    ])
  })

  test('a pending crop is left at full resolution for Payload to crop', async () => {
    const { calls, sharp } = sharpStub()
    const crop = { uploadEdits: { crop: { height: 50, width: 50, x: 0, y: 0 } } }

    await convertAvifToWebp(hookArgs(file(), sharp, crop))

    expect(calls[0]?.resize).toBeUndefined()
  })

  test('other formats are left to formatOptions', async () => {
    const { calls, sharp } = sharpStub()
    const uploaded = file({ mimetype: 'image/jpeg', name: 'photo.jpg' })

    await convertAvifToWebp(hookArgs(uploaded, sharp))

    expect(uploaded).toMatchObject({ mimetype: 'image/jpeg', name: 'photo.jpg' })
    expect(calls).toHaveLength(0)
  })

  test('no-op without a file or without sharp configured', async () => {
    const { sharp } = sharpStub()
    const uploaded = file()

    await convertAvifToWebp(hookArgs(undefined, sharp))
    await convertAvifToWebp(hookArgs(uploaded, undefined))

    expect(uploaded).toMatchObject({ mimetype: 'image/avif', name: 'photo.avif' })
  })
})

describe('withWebpSizes', () => {
  const webp = { format: 'webp', options: { quality: 80 } }

  test('every size is encoded as WebP', () => {
    expect(withWebpSizes([{ name: 'hero', width: 1920 }])).toEqual([
      { formatOptions: webp, name: 'hero', width: 1920 },
    ])
  })

  test('a size that asks for its own format keeps it', () => {
    const avif = { format: 'avif' as const, options: { quality: 60 } }

    expect(withWebpSizes([{ formatOptions: avif, name: 'hero', width: 1920 }])).toEqual([
      { formatOptions: avif, name: 'hero', width: 1920 },
    ])
  })

  test('the input sizes are not mutated', () => {
    const imageSizes = [{ name: 'hero', width: 1920 }]
    withWebpSizes(imageSizes)

    expect(imageSizes).toEqual([{ name: 'hero', width: 1920 }])
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
      formatOptions: { format: 'webp', options: { quality: 90 } },
      imageSizes: withWebpSizes(defaultImageSizes),
      mimeTypes: defaultMimeTypes,
      resizeOptions: { width: 2560, withoutEnlargement: true },
    })

  })

  test('SVG is not accepted by default', () => {
    // `image/*` would match it, and uploads are publicly readable by default.
    expect(defaultMimeTypes).not.toContain('image/svg+xml')
    expect(defaultMimeTypes).not.toContain('image/*')
  })

  test('custom mimeTypes replace the defaults, so SVG can be opted back in', () => {
    const mimeTypes = [...defaultMimeTypes, 'image/svg+xml']
    const config = ComposiusPayloadPluginMedia({ mimeTypes })(baseConfig())

    expect(upload(findMedia(config)).mimeTypes).toEqual(mimeTypes)
  })

  test('custom image sizes replace the defaults', () => {
    const imageSizes = [{ name: 'hero', width: 1920 }]
    const config = ComposiusPayloadPluginMedia({ imageSizes })(baseConfig())

    expect(upload(findMedia(config))).toMatchObject({
      adminThumbnail: 'hero',
      imageSizes: withWebpSizes(imageSizes),
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
    const [, , hook] = findMedia(config).hooks?.beforeOperation ?? []
    expect(hook).toBeDefined()

    const req = { file: { name: 'photo.png' } }
    hook!({ operation: 'create', req } as Parameters<CollectionBeforeOperationHook>[0])
    expect(req.file.name).toMatch(/^photo-[0-9a-f]{8}\.png$/)

    const untouched = { file: { name: 'photo.png' } }
    hook!({ operation: 'read', req: untouched } as Parameters<CollectionBeforeOperationHook>[0])
    expect(untouched.file.name).toBe('photo.png')
  })

  test('randomSuffix: false drops the rename hook', () => {
    const config = ComposiusPayloadPluginMedia({ randomSuffix: false })(baseConfig())
    const hooks = findMedia(config).hooks?.beforeOperation ?? []

    expect(hooks).toHaveLength(2)
    expect(hooks[1]).toBe(convertAvifToWebp)
  })

  test('uploads are limited to 5 MB by default', () => {
    const config = ComposiusPayloadPluginMedia()(baseConfig())
    const [hook] = findMedia(config).hooks?.beforeOperation ?? []
    const args = (size: number) =>
      ({ operation: 'create', req: { file: { name: 'photo.jpg', size } } }) as unknown as Parameters<
        CollectionBeforeOperationHook
      >[0]

    expect(() => hook!(args(5 * 1024 * 1024))).not.toThrow()
    expect(() => hook!(args(5 * 1024 * 1024 + 1))).toThrow(/5 MB/)
  })

  test('maxFileSize overrides the default', () => {
    const config = ComposiusPayloadPluginMedia({ maxFileSize: 500 })(baseConfig())
    const [hook] = findMedia(config).hooks?.beforeOperation ?? []
    const args = (size: number) =>
      ({ operation: 'create', req: { file: { name: 'photo.jpg', size } } }) as unknown as Parameters<
        CollectionBeforeOperationHook
      >[0]

    expect(() => hook!(args(500))).not.toThrow()
    expect(() => hook!(args(501))).toThrow()
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

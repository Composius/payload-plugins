import type {
  Access,
  CollectionBeforeOperationHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  Config,
} from 'payload'

import { describe, expect, test } from 'vitest'

import { anyone, authenticated, defaultImageSizes } from '../src/defaults.js'
import { buildPrefix, uniqueFilename, VWPayloadPluginMedia } from '../src/index.js'

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

describe('VWPayloadPluginMedia', () => {
  test('adds the media upload collection', () => {
    const config = VWPayloadPluginMedia()(baseConfig())
    const media = findMedia(config)

    const fieldNames = media.fields.map((field) => (field as { name?: string }).name)
    expect(fieldNames).toContain('alt')

    expect(upload(media)).toMatchObject({
      adminThumbnail: 'thumbnail',
      formatOptions: { format: 'webp', options: { quality: 90 } },
      imageSizes: defaultImageSizes,
      mimeTypes: ['image/*'],
      resizeOptions: { width: 2560, withoutEnlargement: true },
    })
  })

  test('custom image sizes replace the defaults', () => {
    const imageSizes = [{ name: 'hero', width: 1920 }]
    const config = VWPayloadPluginMedia({ imageSizes })(baseConfig())

    expect(upload(findMedia(config))).toMatchObject({
      adminThumbnail: 'hero',
      imageSizes,
    })
  })

  test('default access: read is public, writes require a user', () => {
    const config = VWPayloadPluginMedia()(baseConfig())
    const media = findMedia(config)

    expect(media.access?.read).toBe(anyone)
    expect(media.access?.create).toBe(authenticated)
    expect(media.access?.update).toBe(authenticated)
    expect(media.access?.delete).toBe(authenticated)
  })

  test('custom access overrides replace only the provided operations', () => {
    const create: Access = () => false
    const config = VWPayloadPluginMedia({ access: { create } })(baseConfig())
    const media = findMedia(config)

    expect(media.access?.create).toBe(create)
    expect(media.access?.read).toBe(anyone)
  })

  test('renames uploaded files on create by default', () => {
    const config = VWPayloadPluginMedia()(baseConfig())
    const [hook] = findMedia(config).hooks?.beforeOperation ?? []
    expect(hook).toBeDefined()

    const req = { file: { name: 'photo.png' } }
    hook!({ operation: 'create', req } as Parameters<CollectionBeforeOperationHook>[0])
    expect(req.file.name).toMatch(/^photo-[0-9a-f]{8}\.png$/)

    const untouched = { file: { name: 'photo.png' } }
    hook!({ operation: 'read', req: untouched } as Parameters<CollectionBeforeOperationHook>[0])
    expect(untouched.file.name).toBe('photo.png')
  })

  test('randomSuffix: false disables the rename hook', () => {
    const config = VWPayloadPluginMedia({ randomSuffix: false })(baseConfig())
    expect(findMedia(config).hooks?.beforeOperation).toBeUndefined()
  })

  test('prefix option sets data.prefix on create', () => {
    const config = VWPayloadPluginMedia({ prefix: 'uploads/site' })(baseConfig())
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
    const config = VWPayloadPluginMedia()(baseConfig())
    expect(findMedia(config).hooks?.beforeValidate).toBeUndefined()
  })

  test('disabled still registers the collection for schema consistency', () => {
    const config = VWPayloadPluginMedia({ disabled: true })(baseConfig())
    findMedia(config)
  })
})

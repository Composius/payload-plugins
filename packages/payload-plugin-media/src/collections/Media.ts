import type { CollectionBeforeOperationHook, CollectionConfig, ImageSize } from 'payload'

import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

import type { MediaOptions, MediaPrefix } from '../types.js'

import { label } from '../translations/index.js'

export const buildPrefix = (prefix: MediaPrefix, now = new Date()): string => {
  if (typeof prefix === 'string') {
    return prefix
  }

  const { day = false, folder, month = true, year = true } = prefix

  return [
    folder,
    year ? String(now.getFullYear()) : null,
    month ? String(now.getMonth() + 1).padStart(2, '0') : null,
    day ? String(now.getDate()).padStart(2, '0') : null,
  ]
    .filter(Boolean)
    .join('/')
}

/** Makes a filename unique: `filename-<randomsuffix>.ext`. */
export const uniqueFilename = (filename: string): string => {
  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  return `${base}-${crypto.randomBytes(4).toString('hex')}${ext}`
}

/** Cap for the stored "original". */
const resizeOptions = { width: 2560, withoutEnlargement: true }

/** Encoding of the stored "original", which doubles as the archive copy. */
const originalFormat = { format: 'webp', options: { quality: 90 } } as const

/** Encoding of the generated sizes, which are what browsers are served. */
const sizeFormat = { format: 'webp', options: { quality: 80 } } as const

/**
 * Payload only applies `upload.formatOptions` to the stored original — sizes
 * are generated from the *uploaded* file and keep its format unless the size
 * says otherwise. So a PNG upload would produce a WebP original next to PNG
 * sizes without this.
 */
export const withWebpSizes = (imageSizes: ImageSize[]): ImageSize[] =>
  imageSizes.map((size) => ({ formatOptions: sizeFormat, ...size }))

/**
 * Converts AVIF uploads to WebP up front. `formatOptions` would convert them
 * anyway, but Payload decodes the uploaded file once for the original and
 * again for every generated size, and decoding AVIF is an order of magnitude
 * more expensive than decoding WebP — paying it once takes a 4000×3000 upload
 * from ~12s to ~3s. Cheaper formats are left to `formatOptions`, whose single
 * pass is already the fastest route.
 */
export const convertAvifToWebp: CollectionBeforeOperationHook = async ({ req }) => {
  const { file } = req
  const { sharp } = req.payload.config

  if (!sharp || !file || file.mimetype !== 'image/avif') {
    return
  }

  const image = sharp(file.tempFilePath || file.data, { animated: true }).rotate() // apply the EXIF orientation, which the WebP output drops

  // Payload crops before it resizes, using pixel values the admin measured on
  // the file as uploaded, so downscaling first would move the crop box
  const uploadEdits = req.query?.uploadEdits as undefined | { crop?: unknown }
  if (!uploadEdits?.crop) {
    image.resize(resizeOptions)
  }

  // `formatOptions` re-encodes this buffer at its own quality, so this pass
  // only has to avoid *losing* quality: `effort: 0` keeps it cheap
  const converted = await image.webp({ effort: 0, quality: 90 }).toBuffer()

  if (file.tempFilePath) {
    // `file.data` is an empty buffer when Payload runs with `useTempFiles`
    await fs.writeFile(file.tempFilePath, converted)
  } else {
    file.data = converted
  }

  file.mimetype = 'image/webp'
  file.name = `${path.basename(file.name, path.extname(file.name))}.webp`
  file.size = converted.length
}

export const Media = ({
  access,
  imageSizes,
  prefix,
  randomSuffix,
  staticDir,
}: MediaOptions): CollectionConfig => ({
  slug: 'media',
  labels: {
    singular: label((t) => t.media.singular),
    plural: label((t) => t.media.plural),
  },
  access: {
    read: access.read,
    create: access.create,
    update: access.update,
    delete: access.delete,
  },
  hooks: {
    beforeOperation: [
      convertAvifToWebp, // runs first so the random suffix lands on the .webp name
      ...(randomSuffix
        ? [
            ({ operation, req }: Parameters<CollectionBeforeOperationHook>[0]) => {
              if (operation === 'create' && req.file?.name) {
                req.file.name = uniqueFilename(req.file.name)
              }
            },
          ]
        : []),
    ],
    ...(prefix !== undefined && {
      beforeValidate: [
        // Cloud storage plugins (e.g. @payloadcms/storage-s3) read this
        // `prefix` field when building the object key
        ({ data, operation }) => {
          if (operation === 'create' && data) {
            data.prefix = buildPrefix(prefix)
          }
          return data
        },
      ],
    }),
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: label((t) => t.fields.alt),
    },
  ],
  upload: {
    adminThumbnail: imageSizes.some((size) => size.name === 'thumbnail')
      ? 'thumbnail'
      : imageSizes[0]?.name,
    formatOptions: originalFormat,
    imageSizes: withWebpSizes(imageSizes),
    mimeTypes: ['image/*'],
    resizeOptions: { width: 2560, withoutEnlargement: true }, // cap the "original"
    ...(staticDir !== undefined && { staticDir }),
  },
})

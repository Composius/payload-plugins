import type { CollectionBeforeOperationHook, CollectionConfig, ImageSize } from 'payload'

import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { APIError } from 'payload'

import type { MediaOptions, MediaPrefix } from '../types.js'

import { label, translation } from '../translations/index.js'

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

/** `5242880` → `5 MB`, `512000` → `500 KB`. */
const formatSize = (bytes: number): string => {
  const units = ['bytes', 'KB', 'MB', 'GB']
  const unit = bytes < 1024 ? 0 : Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3)
  return `${Math.round((bytes / 1024 ** unit) * 100) / 100} ${units[unit]}`
}

/**
 * Rejects uploads over `maxFileSize`, before any image processing happens.
 * Payload has no per-collection limit — `upload.limits.fileSize` in the Payload
 * config is app-wide — so the check lives here. It runs once the file has been
 * received, so set that app-wide limit too if you need oversized requests
 * aborted while they are still being parsed.
 */
export const enforceMaxFileSize =
  (maxFileSize: number): CollectionBeforeOperationHook =>
  ({ req }) => {
    const { file } = req

    if (!file) {
      return
    }

    // `upload.limits.fileSize` truncates the file rather than failing unless
    // `abortOnLimit` is set, and a truncated file sits exactly on that limit —
    // so it would pass the size check below and be stored half-decoded
    const { truncated } = file as { truncated?: boolean }

    if (!truncated && file.size <= maxFileSize) {
      return
    }

    // An APIError rather than a ValidationError: `file` is not a form field,
    // so the admin would only show "the following field is invalid" for it,
    // whereas an APIError message is toasted as-is
    throw new APIError(
      translation(req.i18n?.language).errors.fileTooLarge(formatSize(maxFileSize)),
      413, // Payload Too Large
    )
  }

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
  const uploadEdits = req.query?.uploadEdits as { crop?: unknown } | undefined
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
  maxFileSize,
  mimeTypes,
  prefix,
  randomSuffix,
  staticDir,
}: MediaOptions): CollectionConfig => ({
  slug: 'media',
  access: {
    create: access.create,
    delete: access.delete,
    read: access.read,
    update: access.update,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: label((t) => t.fields.alt),
    },
  ],
  hooks: {
    beforeOperation: [
      enforceMaxFileSize(maxFileSize), // reject before doing any work on the file
      convertAvifToWebp, // runs before the rename so the suffix lands on the .webp name
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
  labels: {
    plural: label((t) => t.media.plural),
    singular: label((t) => t.media.singular),
  },
  upload: {
    adminThumbnail: imageSizes.some((size) => size.name === 'thumbnail')
      ? 'thumbnail'
      : imageSizes[0]?.name,
    formatOptions: originalFormat,
    imageSizes: withWebpSizes(imageSizes),
    mimeTypes,
    resizeOptions: { width: 2560, withoutEnlargement: true }, // cap the "original"
    ...(staticDir !== undefined && { staticDir }),
  },
})

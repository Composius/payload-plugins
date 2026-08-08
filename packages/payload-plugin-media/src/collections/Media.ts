import type { CollectionBeforeOperationHook, CollectionConfig } from 'payload'

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

/**
 * Mime types converted to WebP. AVIF is left alone — it is already a modern
 * format and transcoding it to WebP only costs quality — and so is anything
 * sharp cannot re-encode (SVG…), which passes through untouched.
 */
export const convertedToWebp = ['image/gif', 'image/jpeg', 'image/png', 'image/tiff']

/** Cap for the stored "original". */
const resizeOptions = { width: 2560, withoutEnlargement: true }

/**
 * Converts the uploaded file to WebP before Payload processes it, so that the
 * stored original *and* the generated sizes are WebP. Done here rather than
 * with `upload.formatOptions` because that config is static: it would also
 * transcode AVIF uploads.
 */
export const convertToWebp: CollectionBeforeOperationHook = async ({ req }) => {
  const { file } = req
  const { sharp } = req.payload.config

  if (!sharp || !file || !convertedToWebp.includes(file.mimetype)) {
    return
  }

  const image = sharp(file.tempFilePath || file.data, {
    animated: file.mimetype === 'image/gif',
  }).rotate() // apply the EXIF orientation, which the WebP output drops

  // Payload crops before it resizes, using pixel values the admin measured on
  // the file as uploaded, so downscaling first would move the crop box
  const uploadEdits = req.query?.uploadEdits as undefined | { crop?: unknown }
  if (!uploadEdits?.crop) {
    // Applying the cap here rather than leaving it all to `resizeOptions`
    // keeps the encode below from working on pixels Payload throws away
    image.resize(resizeOptions)
  }

  // Payload re-encodes WebP input at its own quality no matter what we do, so
  // this pass only has to avoid *losing* quality: `effort: 0` halves its cost
  // in exchange for a fatter buffer that never leaves memory
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
      convertToWebp, // runs first so the random suffix lands on the .webp name
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
    imageSizes,
    mimeTypes: ['image/*'],
    resizeOptions, // caps AVIF, and WebP that `convertToWebp` left at full size
    ...(staticDir !== undefined && { staticDir }),
  },
})

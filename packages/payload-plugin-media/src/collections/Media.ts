import type { CollectionConfig } from 'payload'

import crypto from 'crypto'
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
    ...(randomSuffix && {
      beforeOperation: [
        ({ operation, req }) => {
          if (operation === 'create' && req.file?.name) {
            req.file.name = uniqueFilename(req.file.name)
          }
        },
      ],
    }),
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
    formatOptions: { format: 'webp', options: { quality: 90 } },
    imageSizes,
    mimeTypes: ['image/*'],
    resizeOptions: { width: 2560, withoutEnlargement: true }, // cap the "original"
    ...(staticDir !== undefined && { staticDir }),
  },
})

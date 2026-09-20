import type { Config, ImageSize } from 'payload'

import type { MediaAccess, MediaPrefix } from './types.js'

import { Media } from './collections/Media.js'
import { anyone, authenticated, defaultImageSizes, defaultMaxFileSize, defaultMimeTypes } from './defaults.js'

export {
  buildPrefix,
  convertAvifToWebp,
  enforceMaxFileSize,
  uniqueFilename,
  withWebpSizes,
} from './collections/Media.js'
export { defaultImageSizes, defaultMaxFileSize, defaultMimeTypes } from './defaults.js'
export type { MediaAccess, MediaPrefix } from './types.js'

export type ComposiusPayloadPluginMediaConfig = {
  /**
   * Access control for the media collection, per operation.
   * Defaults: `read` allows anyone, `create`/`update`/`delete` require an
   * authenticated user.
   */
  access?: MediaAccess
  disabled?: boolean
  /**
   * Image sizes generated for each upload. Defaults to `thumbnail` (300),
   * `small` (600), `medium` (900), `large` (1400) and `og` (1200×630,
   * center crop). The admin thumbnail uses the `thumbnail` size when
   * present, otherwise the first size. Sizes are encoded as WebP unless
   * they carry their own `formatOptions`.
   */
  imageSizes?: ImageSize[]
  /**
   * Largest accepted upload, in bytes. Default: 5 MB (`5 * 1024 * 1024`).
   * Enforced by a `beforeOperation` hook on the media collection, once the
   * file has been received. Pair it with `upload.limits.fileSize` in your
   * Payload config (app-wide) to have huge requests aborted mid-transfer —
   * give that one headroom, as the parser aborts before any hook runs and
   * answers with its own `responseOnLimit` message instead of this limit's.
   */
  maxFileSize?: number
  /**
   * Upload types the collection accepts. Defaults to the raster formats it can
   * convert and resize: `image/avif`, `image/gif`, `image/jpeg`, `image/png`
   * and `image/webp`.
   *
   * The list replaces the default rather than extending it, so spread it to
   * add to it: `[...defaultMimeTypes, 'image/svg+xml']`. Note that `'image/*'`
   * would also match `image/svg+xml`, and an SVG can carry script — with the
   * default `read` access serving uploads to anyone, that is a stored-XSS
   * vector a raster format is not.
   */
  mimeTypes?: string[]
  /**
   * Storage key prefix written to the document's `prefix` on create, read
   * by cloud storage plugins (e.g. @payloadcms/storage-s3) when building
   * the object key. Pass a full string, or parts
   * (`{ folder, year, month, day }`) joined as
   * `<folder>/<year>/<month>/<day>` — `year` and `month` default to `true`,
   * `day` to `false`. Omit the option to disable prefixing.
   */
  prefix?: MediaPrefix
  /**
   * Append a random hex suffix to uploaded filenames
   * (`filename-<randomsuffix>.ext`) so they are unique. Default: `true`.
   */
  randomSuffix?: boolean
  /**
   * Directory for locally stored files when no cloud storage plugin is
   * used. Defaults to Payload's default (`media` next to the config file).
   */
  staticDir?: string
}

export const ComposiusPayloadPluginMedia =
  (pluginOptions: ComposiusPayloadPluginMediaConfig = {}) =>
  (config: Config): Config => {
    if (!config.collections) {
      config.collections = []
    }

    const access = {
      create: pluginOptions.access?.create ?? authenticated,
      delete: pluginOptions.access?.delete ?? authenticated,
      read: pluginOptions.access?.read ?? anyone,
      update: pluginOptions.access?.update ?? authenticated,
    }

    config.collections.push(
      Media({
        access,
        imageSizes: pluginOptions.imageSizes ?? defaultImageSizes,
        maxFileSize: pluginOptions.maxFileSize ?? defaultMaxFileSize,
        mimeTypes: pluginOptions.mimeTypes ?? defaultMimeTypes,
        prefix: pluginOptions.prefix,
        randomSuffix: pluginOptions.randomSuffix ?? true,
        staticDir: pluginOptions.staticDir,
      }),
    )

    /**
     * If the plugin is disabled, we still want to keep added collections/fields so the database schema is consistent which is important for migrations.
     */
    if (pluginOptions.disabled) {
      return config
    }

    return config
  }

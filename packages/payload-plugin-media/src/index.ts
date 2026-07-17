import type { Config, ImageSize } from 'payload'

import type { MediaAccess, MediaPrefix } from './types.js'

import { Media } from './collections/Media.js'
import { anyone, authenticated, defaultImageSizes } from './defaults.js'

export { buildPrefix, uniqueFilename } from './collections/Media.js'
export { defaultImageSizes } from './defaults.js'
export type { MediaAccess, MediaPrefix } from './types.js'

export type VWPayloadPluginMediaConfig = {
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
   * present, otherwise the first size.
   */
  imageSizes?: ImageSize[]
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

export const VWPayloadPluginMedia =
  (pluginOptions: VWPayloadPluginMediaConfig = {}) =>
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

import type { Access, ImageSize } from 'payload'

export type MediaAccess = {
  create?: Access
  delete?: Access
  read?: Access
  update?: Access
}

/**
 * Storage key prefix for uploaded objects. Either a full prefix string used
 * as-is, or parts assembled into `<folder>/<year>/<month>/<day>` (disabled
 * or empty parts are skipped).
 */
export type MediaPrefix =
  | {
      /** Include the day of the month (2 digits). Default: `false`. */
      day?: boolean
      /** Static root folder, e.g. a bucket subfolder. */
      folder?: string
      /** Include the month (2 digits). Default: `true`. */
      month?: boolean
      /** Include the full year. Default: `true`. */
      year?: boolean
    }
  | string

export type MediaOptions = {
  access: Required<MediaAccess>
  imageSizes: ImageSize[]
  prefix?: MediaPrefix
  randomSuffix: boolean
  staticDir?: string
}

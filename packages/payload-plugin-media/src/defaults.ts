import type { Access, ImageSize } from 'payload'

export const anyone: Access = () => true

export const authenticated: Access = ({ req: { user } }) => Boolean(user)

/** Largest accepted upload, in bytes. */
export const defaultMaxFileSize = 5 * 1024 * 1024

/**
 * Upload types accepted by default: the raster formats this collection knows
 * how to convert and resize.
 *
 * Deliberately narrower than `image/*`, which also matches `image/svg+xml` —
 * an SVG is a document that can carry script, and the default `read` access
 * here serves uploads to anyone. Add it back through the `mimeTypes` option if
 * you need it.
 */
export const defaultMimeTypes = [
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]

export const defaultImageSizes: ImageSize[] = [
  { name: 'thumbnail', width: 300 },
  { name: 'small', width: 600 },
  { name: 'medium', width: 900 },
  { name: 'large', width: 1400 },
  { name: 'og', width: 1200, height: 630, crop: 'center' }, // social sharing
]

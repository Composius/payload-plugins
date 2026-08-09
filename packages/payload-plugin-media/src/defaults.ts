import type { Access, ImageSize } from 'payload'

export const anyone: Access = () => true

export const authenticated: Access = ({ req: { user } }) => Boolean(user)

/** Largest accepted upload, in bytes. */
export const defaultMaxFileSize = 5 * 1024 * 1024

export const defaultImageSizes: ImageSize[] = [
  { name: 'thumbnail', width: 300 },
  { name: 'small', width: 600 },
  { name: 'medium', width: 900 },
  { name: 'large', width: 1400 },
  { name: 'og', width: 1200, height: 630, crop: 'center' }, // social sharing
]

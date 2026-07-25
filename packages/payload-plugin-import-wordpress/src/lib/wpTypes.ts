/** Minimal shapes of the WordPress REST API resources the importer reads. */

export type WPRendered = { rendered?: string }

export type WPPost = {
  author?: number
  categories?: number[]
  content?: WPRendered
  date_gmt?: string
  date?: string
  excerpt?: WPRendered
  featured_media?: number
  id: number
  link?: string
  slug?: string
  status?: string
  title?: WPRendered
  _embedded?: {
    author?: WPUser[]
    'wp:featuredmedia'?: WPMedia[]
    'wp:term'?: WPCategory[][]
  }
}

export type WPCategory = {
  description?: string
  id: number
  link?: string
  name?: string
  parent?: number
  slug?: string
  taxonomy?: string
}

export type WPUser = {
  avatar_urls?: Record<string, string>
  description?: string
  email?: string
  id: number
  name?: string
  slug?: string
  url?: string
}

export type WPMediaSize = { height?: number; source_url?: string; width?: number }

export type WPMedia = {
  alt_text?: string
  id: number
  media_details?: {
    height?: number
    sizes?: Record<string, WPMediaSize>
    width?: number
  }
  mime_type?: string
  source_url?: string
  title?: WPRendered
}

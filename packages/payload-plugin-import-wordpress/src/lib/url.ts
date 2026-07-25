/** Pure URL/string helpers used by the WordPress importer. All side-effect free (unit-tested). */

/** Lower-cased host of a URL, or `null` when it can't be parsed. */
export const hostOf = (url: string): null | string => {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return null
  }
}

/** The path (no host, no query/hash) of a URL, always starting with `/`. */
export const pathOf = (url: string): string => {
  try {
    return new URL(url).pathname || '/'
  } catch {
    // Already a path.
    const [pathAndQuery] = url.split('#')
    const [path] = pathAndQuery.split('?')
    return path.startsWith('/') ? path : `/${path}`
  }
}

/** Whether `url` points at the same host as the WordPress site. Relative URLs count as internal. */
export const isInternalUrl = (url: string, siteHost: string): boolean => {
  if (!url) {
    return false
  }
  if (url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
    return false
  }
  const host = hostOf(url)
  if (host === null) {
    // Relative link → internal to the site.
    return true
  }
  return host === siteHost.toLowerCase()
}

/**
 * Extracts the final path segment of a WordPress permalink as a candidate slug.
 * Handles trailing slashes and `/YYYY/MM/slug/` date-based permalinks.
 */
export const permalinkToSlug = (url: string): null | string => {
  const path = pathOf(url).replace(/\/+$/, '')
  if (!path || path === '') {
    return null
  }
  const segments = path.split('/').filter(Boolean)
  const last = segments[segments.length - 1]
  return last ? decodeURIComponent(last) : null
}

/**
 * Derives the original (full-size) image URL from a WordPress-resized URL by
 * stripping the `-<width>x<height>` suffix WordPress appends before the
 * extension (e.g. `photo-1024x768.jpg` → `photo.jpg`). Returns the input
 * unchanged when no such suffix is present.
 */
export const deriveOriginalImageUrl = (url: string): string => {
  const [beforeHash] = url.split('#')
  const [path, query] = beforeHash.split('?')
  const original = path.replace(/-\d+x\d+(\.[a-zA-Z0-9]+)$/, '$1')
  return query ? `${original}?${query}` : original
}

/** Basename of a URL path, used as the uploaded filename. */
export const filenameOf = (url: string): string => {
  const path = pathOf(url)
  const base = path.split('/').filter(Boolean).pop() ?? 'image'
  return decodeURIComponent(base) || 'image'
}

/** Named HTML entities WordPress commonly emits (beyond numeric references). */
const NAMED_ENTITIES: Record<string, string> = {
  agrave: 'à',
  amp: '&',
  apos: "'",
  bdquo: '„',
  bull: '•',
  ccedil: 'ç',
  copy: '©',
  deg: '°',
  eacute: 'é',
  ecirc: 'ê',
  egrave: 'è',
  gt: '>',
  hellip: '…',
  laquo: '«',
  ldquo: '“',
  lsaquo: '‹',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  middot: '·',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  raquo: '»',
  rdquo: '”',
  reg: '®',
  rsaquo: '›',
  rsquo: '’',
  sbquo: '‚',
  trade: '™',
}

/**
 * Decodes the HTML entities WordPress emits in titles/excerpts: all numeric
 * references (`&#8217;`, `&#x2019;`) plus the common named ones (`&rsquo;`,
 * `&hellip;`, …). Unknown named entities are left as-is. Because `.replace`
 * never rescans replaced output, `&amp;rsquo;` correctly stays `&rsquo;`.
 */
export const decodeEntities = (value: string): string =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    .trim()

/** Strips HTML tags (for excerpt → plain-text SEO description). */
export const stripHtml = (html: string): string =>
  decodeEntities(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')).trim()

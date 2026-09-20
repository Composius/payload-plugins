export type VideoEmbedProvider = 'ganjingWorld' | 'vimeo' | 'youtube'

export type VideoEmbed = {
  /** URL to put in the `src` of an iframe. */
  embedUrl: string
  /** Id of the video on the provider's platform. */
  id: string
  provider: VideoEmbedProvider
}

/** Matches a domain and any subdomain of it (`youtube.com`, `www.youtube.com`). */
const hostIs = (hostname: string, ...domains: string[]): boolean =>
  domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))

const segmentsOf = (pathname: string): string[] => pathname.split('/').filter(Boolean)

/** Ids are always 11 characters of the URL-safe alphabet. */
const YOUTUBE_ID = /^[\w-]{11}$/

/** Paths that carry the id in their second segment, `/watch?v=` carrying it in the query. */
const YOUTUBE_PATHS = ['embed', 'live', 'shorts', 'v']

const youtube = (url: URL): undefined | VideoEmbed => {
  if (!hostIs(url.hostname, 'youtube.com', 'youtube-nocookie.com', 'youtu.be')) {
    return undefined
  }

  const [first, second] = segmentsOf(url.pathname)

  const id = hostIs(url.hostname, 'youtu.be')
    ? first
    : first === 'watch'
      ? (url.searchParams.get('v') ?? undefined)
      : YOUTUBE_PATHS.includes(first ?? '')
        ? second
        : undefined

  if (!id || !YOUTUBE_ID.test(id)) {
    return undefined
  }

  return { id, embedUrl: `https://www.youtube.com/embed/${id}`, provider: 'youtube' }
}

/**
 * The shapes a Vimeo link comes in, most specific first: a plain `/123456789`
 * would otherwise swallow the numeric id of a group or an album.
 */
const VIMEO_PATHS = [
  /^\/video\/(\d+)/,
  /^\/groups\/[^/]+\/videos\/(\d+)/,
  /^\/channels\/[^/]+\/(\d+)/,
  /^\/album\/[^/]+\/video\/(\d+)/,
  /^\/(\d+)(?:\/([\da-z]+))?/i,
]

const vimeo = (url: URL): undefined | VideoEmbed => {
  if (!hostIs(url.hostname, 'vimeo.com')) {
    return undefined
  }

  const match = VIMEO_PATHS.reduce<null | RegExpExecArray>(
    (found, pattern) => found ?? pattern.exec(url.pathname),
    null,
  )

  const id = match?.[1]
  if (!id) {
    return undefined
  }

  // Unlisted videos are only playable with their hash, given either as the
  // segment after the id (`vimeo.com/123/abc`) or as `?h=` on a player link.
  const hash = url.searchParams.get('h') ?? match[2]
  const embedUrl = `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ''}`

  return { id, embedUrl, provider: 'vimeo' }
}

/** `/video/<id>` or `/embed/<id>`, optionally behind a locale segment (`/zh-TW/video/<id>`). */
const GANJING_WORLD_PATH = /^(?:\/[a-z]{2}(?:-[a-zA-Z]{2,4})?)?\/(?:embed|video)\/([\w-]+)/

const ganjingWorld = (url: URL): undefined | VideoEmbed => {
  // ganjing.com redirects to ganjingworld.com, and editors do paste both.
  if (!hostIs(url.hostname, 'ganjingworld.com', 'ganjing.com')) {
    return undefined
  }

  const id = GANJING_WORLD_PATH.exec(url.pathname)?.[1]
  if (!id) {
    return undefined
  }

  return { id, embedUrl: `https://www.ganjingworld.com/embed/${id}`, provider: 'ganjingWorld' }
}

/** Tolerates a link pasted without its scheme, and rejects anything but http(s). */
const toUrl = (value: string): undefined | URL => {
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

const parsers = [youtube, vimeo, ganjingWorld]

/**
 * Reads a YouTube, Vimeo or Gan Jing World link and returns what it takes to
 * embed it — the provider, the video id, and the player URL for an iframe.
 * `null` for anything else, which is what makes it a validator too.
 */
export const parseVideoEmbedUrl = (value: string): null | VideoEmbed => {
  const url = toUrl(value)
  if (!url) {
    return null
  }

  return parsers.reduce<null | VideoEmbed>((found, parse) => found ?? parse(url) ?? null, null)
}

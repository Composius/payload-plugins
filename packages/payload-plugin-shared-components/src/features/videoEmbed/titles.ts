import type { VideoEmbed } from './providers.js'

/** A provider that is slow, down or blocked must not hold a save open. */
export const TITLE_TIMEOUT_MS = 5_000

/**
 * The oEmbed endpoint of the providers that have one, and the link shape it
 * answers for: YouTube only resolves `watch` links, not `/embed/` ones, while
 * Vimeo takes the player URL — which is the one carrying the hash an unlisted
 * video needs.
 */
const oEmbedEndpoint = (video: VideoEmbed): string | undefined => {
  const oEmbed = (endpoint: string, url: string) =>
    `${endpoint}${endpoint.includes('?') ? '&' : '?'}url=${encodeURIComponent(url)}`

  switch (video.provider) {
    case 'vimeo':
      return oEmbed('https://vimeo.com/api/oembed.json', video.embedUrl)
    case 'youtube':
      return oEmbed(
        'https://www.youtube.com/oembed?format=json',
        `https://www.youtube.com/watch?v=${video.id}`,
      )
    default:
      return undefined
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

/** Meta tags are HTML-escaped; a title reaches the editor as it reads on the page. */
const decodeEntities = (text: string): string =>
  text.replace(/&(#x?[\da-f]+|[a-z]+);/gi, (entity, name: string) => {
    if (!name.startsWith('#')) {
      return ENTITIES[name.toLowerCase()] ?? entity
    }

    const code =
      name[1]?.toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10)

    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity
  })

/** `og:title` (or the Twitter one), whichever order the attributes come in. */
const metaTitle = (html: string): string | undefined => {
  for (const tag of html.match(/<meta[^>]+>/gi) ?? []) {
    if (!/(?:name|property)=["'](?:og:title|twitter:title)["']/i.test(tag)) {
      continue
    }

    const content = /content=["']([^"']*)["']/i.exec(tag)?.[1]
    if (content) {
      return decodeEntities(content).trim()
    }
  }

  return undefined
}

/**
 * The title a provider gives for a video, or `null` when it gives none — an
 * unlisted or deleted video, a provider that is down, a network the CMS cannot
 * reach. It never throws: the title is a label, and losing it must not cost a
 * save.
 */
export const fetchVideoTitle = async (
  video: VideoEmbed,
  timeoutMs: number = TITLE_TIMEOUT_MS,
): Promise<null | string> => {
  try {
    const signal = AbortSignal.timeout(timeoutMs)
    const endpoint = oEmbedEndpoint(video)

    if (endpoint) {
      const response = await fetch(endpoint, { signal })
      if (!response.ok) {
        return null
      }

      const { title } = (await response.json()) as { title?: unknown }

      return typeof title === 'string' && title.trim().length > 0 ? title.trim() : null
    }

    // Gan Jing World publishes no oEmbed endpoint, so the video page it is.
    const response = await fetch(`https://www.ganjingworld.com/video/${video.id}`, { signal })
    if (!response.ok) {
      return null
    }

    return metaTitle(await response.text()) ?? null
  } catch {
    return null
  }
}

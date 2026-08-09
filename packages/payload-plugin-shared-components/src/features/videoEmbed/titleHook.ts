import type { RichTextHooks } from 'payload'
import { VIDEO_EMBED_BLOCK_SLUG } from './block.js'
import { parseVideoEmbedUrl } from './providers.js'
import { fetchVideoTitle } from './titles.js'

type BeforeChangeRichTextHook = NonNullable<RichTextHooks['beforeChange']>[number]

/** The `fields` of a video embed block node, as they sit in the lexical JSON. */
type VideoEmbedFields = {
  blockType?: unknown
  title?: unknown
  titleUnavailable?: unknown
  url?: unknown
}

const isVideoEmbed = (fields: unknown): fields is VideoEmbedFields =>
  typeof fields === 'object' &&
  fields !== null &&
  (fields as { blockType?: unknown }).blockType === VIDEO_EMBED_BLOCK_SLUG

/**
 * The video embed blocks anywhere in a lexical tree. Walking every value rather
 * than `children` alone reaches the ones nested in the rich text of another
 * block, which is a tree of its own.
 */
const videoEmbedsIn = (value: unknown, found: VideoEmbedFields[] = []): VideoEmbedFields[] => {
  if (Array.isArray(value)) {
    for (const item of value) {
      videoEmbedsIn(item, found)
    }

    return found
  }

  if (typeof value !== 'object' || value === null) {
    return found
  }

  const node = value as Record<string, unknown>
  if (node.type === 'block' && isVideoEmbed(node.fields)) {
    found.push(node.fields)
  }

  for (const child of Object.values(node)) {
    videoEmbedsIn(child, found)
  }

  return found
}

const urlOf = (fields: VideoEmbedFields): string =>
  typeof fields.url === 'string' ? fields.url.trim() : ''

/**
 * Fills the read-only `title` of every video embed block from its provider, on
 * the way into the database.
 *
 * Only a link the previous save did not already resolve is looked up — these
 * collections autosave, and a document is written far more often than its
 * videos change. A link that could not be resolved is remembered as such
 * (`titleUnavailable`), so a dead video is not re-fetched on every keystroke
 * either; editing the link is what asks again.
 */
export const fillVideoEmbedTitles: BeforeChangeRichTextHook = async ({ previousValue, value }) => {
  const embeds = videoEmbedsIn(value)
  if (embeds.length === 0) {
    return value
  }

  const resolved = new Map<string, VideoEmbedFields>()
  for (const fields of videoEmbedsIn(previousValue)) {
    const url = urlOf(fields)
    if (url && (typeof fields.title === 'string' || fields.titleUnavailable === true)) {
      resolved.set(url, fields)
    }
  }

  // One lookup per link, however many blocks point at it, and all at once.
  const lookups = new Map(
    embeds
      .map((fields) => [urlOf(fields), parseVideoEmbedUrl(urlOf(fields))] as const)
      .filter(([url, video]) => video !== null && !resolved.has(url)),
  )

  const titles = new Map(
    await Promise.all(
      [...lookups].map(async ([url, video]) => [url, await fetchVideoTitle(video!)] as const),
    ),
  )

  for (const fields of embeds) {
    const url = urlOf(fields)

    // An empty or unsupported link carries no title; `validate` reports it.
    if (!url || !parseVideoEmbedUrl(url)) {
      delete fields.title
      delete fields.titleUnavailable
      continue
    }

    const previous = resolved.get(url)
    const title = previous ? previous.title : titles.get(url)

    if (typeof title === 'string' && title.length > 0) {
      fields.title = title
      delete fields.titleUnavailable
    } else {
      delete fields.title
      fields.titleUnavailable = true
    }
  }

  return value
}

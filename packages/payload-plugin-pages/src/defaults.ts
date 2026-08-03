import type { GenerateDescription } from '@payloadcms/plugin-seo/types'
import { defaultGenerateDescription as describeRichText } from '@composius/payload-plugin-shared-components'
import { CONTENT_BLOCK_SLUG } from './blocks/content.js'

export {
  authenticated,
  authenticatedOrPublished,
  defaultGenerateImage,
  defaultGenerateTitle,
  defaultGenerateURL,
  SEO_DESCRIPTION_MAX_LENGTH,
} from '@composius/payload-plugin-shared-components'

/** Pages live at the site root, unlike articles which live under /articles/. */
export const defaultPageUrl = (slug?: string | null) =>
  `${process.env.NEXT_PUBLIC_SERVER_URL || process.env.SERVER_URL || 'http://localhost:3000'}/${slug ?? ''}`

/** The rich text of the first content block of a layout, if it holds one. */
const layoutContent = (layout: unknown): unknown => {
  if (!Array.isArray(layout)) {
    return undefined
  }

  const block = layout.find(
    (entry) => (entry as { blockType?: unknown })?.blockType === CONTENT_BLOCK_SLUG,
  )

  return (block as { content?: unknown })?.content
}

/**
 * The meta description, read from the `content` field when the collection has
 * one and from the first content block of the layout otherwise — the same prose
 * either way, since a page written in blocks has no top-level `content`.
 */
export const defaultGenerateDescription: GenerateDescription = (args) => {
  const doc = args.doc as { content?: unknown; layout?: unknown } | undefined
  const content = doc?.content ?? layoutContent(doc?.layout)

  return describeRichText({ ...args, doc: { ...doc, content } })
}

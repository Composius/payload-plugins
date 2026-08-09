import type {
  GenerateDescription,
  GenerateImage,
  GenerateTitle,
  GenerateURL,
} from '@payloadcms/plugin-seo/types'

export const SEO_DESCRIPTION_MAX_LENGTH = 150

/** Collects the plain text of a lexical richText value, for the default meta description. */
const richTextToPlainText = (content: unknown): string => {
  const texts: string[] = []

  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') {
      return
    }
    const { children, text } = node as { children?: unknown[]; text?: unknown }
    if (typeof text === 'string') {
      texts.push(text)
    }
    if (Array.isArray(children)) {
      children.forEach(walk)
    }
  }

  walk((content as { root?: unknown })?.root)

  return texts.join(' ').replace(/\s+/g, ' ').trim()
}

export const defaultGenerateDescription: GenerateDescription = ({ doc }) => {
  const text = richTextToPlainText(doc?.content)
  if (text.length <= SEO_DESCRIPTION_MAX_LENGTH) {
    return text
  }
  return `${text.slice(0, SEO_DESCRIPTION_MAX_LENGTH - 3).trimEnd()}...`
}

export const defaultGenerateImage: GenerateImage = ({ doc }) =>
  (typeof doc?.coverImage === 'object' ? doc?.coverImage?.id : doc?.coverImage) ?? ''

export const defaultGenerateTitle: GenerateTitle = ({ doc }) => doc?.title ?? ''

/** Between the document title and the site name: `Title | Site name`. */
export const SITE_NAME_SEPARATOR = '|'

/**
 * Ends every generated title with the site name. Wraps whichever generator is
 * in play — the default one or a host's own — rather than replacing it.
 *
 * Without a site name the generator is handed straight back, so the option
 * being absent costs nothing at generate time. A document with no title of its
 * own is left with the site name alone, never a dangling separator.
 */
export const withSiteName = (
  generateTitle: GenerateTitle,
  siteName?: string,
  separator: string = SITE_NAME_SEPARATOR,
): GenerateTitle => {
  const name = siteName?.trim()

  if (!name) {
    return generateTitle
  }

  return async (args) => {
    const title = (await generateTitle(args))?.trim()

    return title ? `${title} ${separator} ${name}` : name
  }
}

export const defaultGenerateURL =
  (documentUrl: (slug?: string | null) => string): GenerateURL =>
  ({ doc }) =>
    documentUrl(doc?.slug)

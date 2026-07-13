import type {
  GenerateDescription,
  GenerateImage,
  GenerateTitle,
  GenerateURL,
} from '@payloadcms/plugin-seo/types'

export const SEO_DESCRIPTION_MAX_LENGTH = 160

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

export const defaultGenerateDescription: GenerateDescription = ({ doc }) =>
  richTextToPlainText(doc?.content).slice(0, SEO_DESCRIPTION_MAX_LENGTH)

export const defaultGenerateImage: GenerateImage = ({ doc }) =>
  (typeof doc?.coverImage === 'object' ? doc?.coverImage?.id : doc?.coverImage) ?? ''

export const defaultGenerateTitle: GenerateTitle = ({ doc }) => doc?.title ?? ''

export const defaultGenerateURL =
  (documentUrl: (slug?: string | null) => string): GenerateURL =>
  ({ doc }) =>
    documentUrl(doc?.slug)

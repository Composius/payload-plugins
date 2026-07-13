import type { Access } from 'payload'
import type {
  GenerateDescription,
  GenerateImage,
  GenerateTitle,
  GenerateURL,
} from '@payloadcms/plugin-seo/types'

export const SEO_DESCRIPTION_MAX_LENGTH = 160

export const authenticated: Access = ({ req: { user } }) => Boolean(user)

export const authenticatedOrPublished: Access = ({ req: { user } }) => {
  if (user) {
    return true
  }

  return {
    _status: {
      equals: 'published',
    },
  }
}

export const defaultArticleUrl = (slug?: string | null) =>
  `${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}/articles/${slug ?? ''}`

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
  (articleUrl: (slug?: string | null) => string): GenerateURL =>
  ({ doc }) =>
    articleUrl(doc?.slug)

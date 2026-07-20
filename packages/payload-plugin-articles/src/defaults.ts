export {
  anyone,
  authenticated,
  authenticatedField,
  authenticatedOrPublished,
  defaultGenerateDescription,
  defaultGenerateImage,
  defaultGenerateTitle,
  defaultGenerateURL,
  SEO_DESCRIPTION_MAX_LENGTH,
} from '@composius/payload-plugin-shared-components'

export const defaultArticleUrl = (slug?: string | null) =>
  `${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}/articles/${slug ?? ''}`

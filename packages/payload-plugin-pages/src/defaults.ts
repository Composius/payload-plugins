export {
  authenticated,
  authenticatedOrPublished,
  defaultGenerateDescription,
  defaultGenerateImage,
  defaultGenerateTitle,
  defaultGenerateURL,
  SEO_DESCRIPTION_MAX_LENGTH,
} from '@composius/payload-plugin-shared-components'

/** Pages live at the site root, unlike articles which live under /articles/. */
export const defaultPageUrl = (slug?: string | null) =>
  `${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}/${slug ?? ''}`

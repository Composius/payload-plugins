import type { Config } from 'payload'
import type {
  GenerateDescription,
  GenerateImage,
  GenerateTitle,
  GenerateURL,
} from '@payloadcms/plugin-seo/types'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import type { ArticlesAccess } from './collections/Articles.js'
import { Articles } from './collections/Articles.js'
import type { AuthorsAccess } from './collections/Authors.js'
import { Authors } from './collections/Authors.js'
import type { CategoriesAccess } from './collections/Categories.js'
import { Categories } from './collections/Categories.js'
import {
  anyone,
  authenticated,
  authenticatedOrPublished,
  defaultArticleUrl,
  defaultGenerateDescription,
  defaultGenerateImage,
  defaultGenerateTitle,
  defaultGenerateURL,
} from './defaults.js'

export type ComposiusPayloadPluginArticlesConfig = {
  /**
   * Access control for the articles collection, per operation.
   * Defaults: `read` allows authenticated users or published documents,
   * `create`/`update`/`delete` require an authenticated user.
   */
  access?: ArticlesAccess
  /**
   * Access control for the authors collection, per operation.
   * Defaults: `read` allows anyone, `create`/`update`/`delete` require an
   * authenticated user.
   */
  authorsAccess?: AuthorsAccess
  /**
   * Access control for the categories collection, per operation.
   * Defaults: `read` allows anyone, `create`/`update`/`delete` require an
   * authenticated user.
   */
  categoriesAccess?: CategoriesAccess
  /**
   * Builds the front-end URL of an article, used for admin preview and live preview.
   * Defaults to `${NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}/articles/${slug}`.
   */
  articleUrl?: (slug?: string | null) => string
  disabled?: boolean
  /**
   * Adds an SEO `meta` group (title, description, image, preview) to the
   * articles collection, built from `@payloadcms/plugin-seo` fields.
   * `true` (the default) enables it with built-in generate functions
   * (title from the article title, description from the content, image from
   * the cover image, URL from `articleUrl`). Pass an object to override any
   * of the generate functions, or `false` to disable SEO entirely.
   * @default true
   */
  seo?:
    | boolean
    | {
        generateDescription?: GenerateDescription
        generateImage?: GenerateImage
        generateTitle?: GenerateTitle
        generateURL?: GenerateURL
      }
  /**
   * Slug of the users collection the article `editor` field relates to.
   * Defaults to `'users'`.
   */
  usersSlug?: string
}

export const ComposiusPayloadPluginArticles =
  (pluginOptions: ComposiusPayloadPluginArticlesConfig = {}) =>
  (config: Config): Config => {
    if (!config.collections) {
      config.collections = []
    }

    const articleUrl = pluginOptions.articleUrl ?? defaultArticleUrl

    const access = {
      create: pluginOptions.access?.create ?? authenticated,
      delete: pluginOptions.access?.delete ?? authenticated,
      read: pluginOptions.access?.read ?? authenticatedOrPublished,
      update: pluginOptions.access?.update ?? authenticated,
    }

    const seoEnabled = pluginOptions.seo !== false
    const seoOverrides = typeof pluginOptions.seo === 'object' ? pluginOptions.seo : {}

    const generateDescription: GenerateDescription =
      seoOverrides.generateDescription ?? defaultGenerateDescription
    const generateImage: GenerateImage = seoOverrides.generateImage ?? defaultGenerateImage
    const generateTitle: GenerateTitle = seoOverrides.generateTitle ?? defaultGenerateTitle
    const generateURL: GenerateURL = seoOverrides.generateURL ?? defaultGenerateURL(articleUrl)

    const categoriesAccess = {
      create: pluginOptions.categoriesAccess?.create ?? authenticated,
      delete: pluginOptions.categoriesAccess?.delete ?? authenticated,
      read: pluginOptions.categoriesAccess?.read ?? anyone,
      update: pluginOptions.categoriesAccess?.update ?? authenticated,
    }

    const authorsAccess = {
      create: pluginOptions.authorsAccess?.create ?? authenticated,
      delete: pluginOptions.authorsAccess?.delete ?? authenticated,
      read: pluginOptions.authorsAccess?.read ?? anyone,
      update: pluginOptions.authorsAccess?.update ?? authenticated,
    }

    const usersSlug = pluginOptions.usersSlug ?? 'users'

    config.collections.push(Categories({ access: categoriesAccess }))

    config.collections.push(Authors({ access: authorsAccess }))

    config.collections.push(
      Articles({
        access,
        articleUrl,
        seo: seoEnabled
          ? {
              hasGenerateDescription: true,
              hasGenerateImage: true,
              hasGenerateTitle: true,
            }
          : false,
        usersSlug,
      }),
    )

    /**
     * If the plugin is disabled, we still want to keep added collections/fields so the database schema is consistent which is important for migrations.
     */
    if (pluginOptions.disabled) {
      return config
    }

    // Adds the breadcrumbs hooks and parent filterOptions to categories.
    // The parent/breadcrumbs fields are declared by Categories itself.
    // nestedDocsPlugin is typed as Plugin (Config | Promise<Config>) but is synchronous.
    config = nestedDocsPlugin({
      collections: ['categories'],
      generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug as string}`, ''),
    })(config) as Config

    if (seoEnabled) {
      // Registers the /plugin-seo/generate-* endpoints the field buttons call.
      // No collections are passed: the meta fields are added by Articles itself.
      config = seoPlugin({
        collections: [],
        generateDescription,
        generateImage,
        generateTitle,
        generateURL,
      })(config)
    }

    return config
  }

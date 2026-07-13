import type { Config } from 'payload'
import type {
  GenerateDescription,
  GenerateImage,
  GenerateTitle,
  GenerateURL,
} from '@payloadcms/plugin-seo/types'
import { seoPlugin } from '@payloadcms/plugin-seo'
import type { PagesAccess } from './collections/Pages.js'
import { Pages } from './collections/Pages.js'
import {
  authenticated,
  authenticatedOrPublished,
  defaultGenerateDescription,
  defaultGenerateImage,
  defaultGenerateTitle,
  defaultGenerateURL,
  defaultPageUrl,
} from './defaults.js'

export type VWPayloadPluginPagesConfig = {
  /**
   * Access control for the pages collection, per operation.
   * Defaults: `read` allows authenticated users or published documents,
   * `create`/`update`/`delete` require an authenticated user.
   */
  access?: PagesAccess
  disabled?: boolean
  /**
   * Builds the front-end URL of a page, used for admin preview and live preview.
   * Defaults to `${NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}/${slug}`.
   */
  pageUrl?: (slug?: string | null) => string
  /**
   * Adds an SEO `meta` group (title, description, image, preview) to the
   * pages collection, built from `@payloadcms/plugin-seo` fields.
   * `true` (the default) enables it with built-in generate functions
   * (title from the page title, description from the content, image from
   * the cover image, URL from `pageUrl`). Pass an object to override any
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
}

export const VWPayloadPluginPages =
  (pluginOptions: VWPayloadPluginPagesConfig = {}) =>
  (config: Config): Config => {
    if (!config.collections) {
      config.collections = []
    }

    const pageUrl = pluginOptions.pageUrl ?? defaultPageUrl

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
    const generateURL: GenerateURL = seoOverrides.generateURL ?? defaultGenerateURL(pageUrl)

    config.collections.push(
      Pages({
        access,
        pageUrl,
        seo: seoEnabled
          ? {
              hasGenerateDescription: true,
              hasGenerateImage: true,
              hasGenerateTitle: true,
            }
          : false,
      }),
    )

    /**
     * If the plugin is disabled, we still want to keep added collections/fields so the database schema is consistent which is important for migrations.
     */
    if (pluginOptions.disabled) {
      return config
    }

    if (seoEnabled) {
      // Registers the /plugin-seo/generate-* endpoints the field buttons call.
      // No collections are passed: the meta fields are added by Pages itself.
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

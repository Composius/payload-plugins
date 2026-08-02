import type { Block, BlockSlug, Config } from 'payload'
import type {
  GenerateDescription,
  GenerateImage,
  GenerateTitle,
  GenerateURL,
} from '@payloadcms/plugin-seo/types'
import { seoPlugin } from '@payloadcms/plugin-seo'
import type {
  RevalidateEvent,
  RevalidateOptions,
  RevalidateProfile,
} from '@composius/payload-plugin-shared-components'
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

export type ComposiusPayloadPluginPagesConfig = {
  /**
   * Access control for the pages collection, per operation.
   * Defaults: `read` allows authenticated users or published documents,
   * `create`/`update`/`delete` require an authenticated user.
   */
  access?: PagesAccess
  /**
   * Blocks of the page `layout` field, referenced instead of defined inline:
   * either a slug of a block registered in `config.blocks`, or the block
   * itself. References keep one block definition shared across every field
   * that uses it, rather than copied into each.
   *
   * Combines with `blocks`; the field is only added when at least one of the
   * two carries something.
   */
  blockReferences?: (Block | BlockSlug)[]
  /**
   * Blocks a page can be laid out with, defined inline on a `layout` field
   * added after `content`. Without them — and without `blockReferences` — no
   * such field exists and a page is title, cover image and rich text.
   */
  blocks?: Block[]
  disabled?: boolean
  /**
   * Builds the front-end URL of a page, used for admin preview and live preview.
   * Defaults to `${NEXT_PUBLIC_SERVER_URL || SERVER_URL || 'http://localhost:3000'}/${slug}`.
   */
  pageUrl?: (slug?: string | null) => string
  /**
   * Invalidates the Next.js cache tags of the pages collection whenever a page
   * is saved or deleted, so a `'use cache'` front end picks the change up. The
   * tags to claim with `cacheTag` are exported from
   * `@composius/payload-plugin-pages/tags`.
   *
   * Enabled by default, and a no-op wherever Next.js is absent (a migration, a
   * seeding script, a test run). Pass an object to tune the cache profile or
   * add tags, or `false` to remove the hooks entirely.
   */
  revalidate?: false | RevalidateOptions
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

export const ComposiusPayloadPluginPages =
  (pluginOptions: ComposiusPayloadPluginPagesConfig = {}) =>
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

    // A disabled plugin keeps its collection for schema consistency, but must
    // not act on it: revalidating from a plugin that is meant to be off would
    // be a side effect nobody asked for.
    const revalidate =
      pluginOptions.disabled || pluginOptions.revalidate === false
        ? false
        : (pluginOptions.revalidate ?? {})

    config.collections.push(
      Pages({
        access,
        blockReferences: pluginOptions.blockReferences ?? [],
        blocks: pluginOptions.blocks ?? [],
        pageUrl,
        revalidate,
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

export type { RevalidateEvent, RevalidateOptions, RevalidateProfile }
export { pageIdTag, pageTag, PAGES_TAG } from './tags.js'

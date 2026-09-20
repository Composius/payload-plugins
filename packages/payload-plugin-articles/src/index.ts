import type {
  EditorFontSize,
  RevalidateEvent,
  RevalidateOptions,
  RevalidateProfile,
  VideoEmbed,
  VideoEmbedProvider,
} from '@composius/payload-plugin-shared-components'
import type {
  GenerateDescription,
  GenerateImage,
  GenerateTitle,
  GenerateURL,
} from '@payloadcms/plugin-seo/types'
import type { CollectionSlug, Config, FieldAccess } from 'payload'

import {
  parseVideoEmbedUrl,
  VIDEO_EMBED_BLOCK_SLUG,
} from '@composius/payload-plugin-shared-components'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { seoPlugin } from '@payloadcms/plugin-seo'

import type { ArticlesAccess } from './collections/Articles.js'
import type { AuthorsAccess } from './collections/Authors.js'
import type { CategoriesAccess } from './collections/Categories.js'

import { Articles } from './collections/Articles.js'
import { Authors } from './collections/Authors.js'
import { Categories } from './collections/Categories.js'
import {
  anyone,
  authenticated,
  authenticatedField,
  authenticatedOrPublished,
  defaultArticleUrl,
  defaultGenerateDescription,
  defaultGenerateImage,
  defaultGenerateTitle,
  defaultGenerateURL,
  withSiteName,
} from './defaults.js'

export type ComposiusPayloadPluginArticlesConfig = {
  /**
   * Access control for the articles collection, per operation.
   * Defaults: `read` allows authenticated users or published documents,
   * `create`/`update`/`delete` require an authenticated user.
   */
  access?: ArticlesAccess
  /**
   * Builds the front-end URL of an article, used for admin preview and live preview.
   * Defaults to `${NEXT_PUBLIC_SERVER_URL || SERVER_URL || 'http://localhost:3000'}/articles/${slug}`.
   */
  articleUrl?: (slug?: null | string) => string
  /**
   * Adds an `authors` collection and an `author` relationship field on
   * articles, for attributing articles to someone other than their `editor`.
   * Disabled by default; pass `true` to enable it.
   * @default false
   */
  authors?: boolean
  /**
   * Access control for the authors collection, per operation.
   * Only applies when `authors` is enabled.
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
  disabled?: boolean
  /**
   * Adds a font size control to the content editor's toolbar, scaling the text
   * of the admin editor between `small`, `normal`, `large` and `huge`. It is
   * CSS over Payload's own sizes and nothing more: no size is written to the
   * document, so a front end renders the content exactly as it did before.
   *
   * The value sets the size an editor opens at; whoever is writing can pick
   * another from the toolbar, and their browser remembers it from then on.
   * `false` leaves the control out, at Payload's own size.
   * @default 'normal'
   */
  editorFontSize?: EditorFontSize | false
  /**
   * Field-level access controlling who may change an article's `editor`.
   * Defaults to any authenticated user.
   */
  editorUpdateAccess?: FieldAccess
  /**
   * Draws the links in the content editor blue and continuously underlined,
   * where Payload draws them green under a dotted border — more contrast
   * against the surrounding prose, so links are easier to pick out while
   * writing.
   *
   * CSS over the admin panel alone, scoped to this plugin's editor: nothing is
   * written to a node, so a front end styles its links however it already did.
   * @default false
   */
  emphasizeEditorLinks?: boolean
  /**
   * Invalidates the Next.js cache tags of the articles, categories and authors
   * collections whenever a document is saved or deleted, so a `'use cache'`
   * front end picks the change up. The tags to claim with `cacheTag` are
   * exported from `@composius/payload-plugin-articles/tags`.
   *
   * Enabled by default, and a no-op wherever Next.js is absent (a migration, a
   * seeding script, a test run). Pass an object to tune the cache profile or
   * add tags, or `false` to remove the hooks entirely.
   */
  revalidate?: false | RevalidateOptions
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
    | {
        generateDescription?: GenerateDescription
        generateImage?: GenerateImage
        generateTitle?: GenerateTitle
        generateURL?: GenerateURL
        /**
         * Ends every generated meta title with the name of the site, as
         * `Title | Site name`. Left out, titles are the document's own.
         *
         * It wraps `generateTitle` rather than competing with it, so a custom
         * one still gets the site name appended.
         */
        siteName?: string
      }
    | boolean
  /**
   * Adds a `Default` checkbox to categories — only one category carries it at
   * a time — and gives it to any article saved without a category: the box is
   * already ticked in the form of a new article, and re-applied on save when
   * the editor cleared it.
   *
   * `false` keeps the checkbox (it is part of the schema either way) but leaves
   * `category` empty on articles that were saved without one.
   * @default true
   */
  useDefaultCategory?: boolean
  /**
   * Slug of the users collection the article `editor` field relates to.
   * Defaults to `'users'`.
   */
  usersSlug?: CollectionSlug
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
    const generateTitle: GenerateTitle = withSiteName(
      seoOverrides.generateTitle ?? defaultGenerateTitle,
      seoOverrides.siteName,
    )
    const generateURL: GenerateURL = seoOverrides.generateURL ?? defaultGenerateURL(articleUrl)

    const categoriesAccess = {
      create: pluginOptions.categoriesAccess?.create ?? authenticated,
      delete: pluginOptions.categoriesAccess?.delete ?? authenticated,
      read: pluginOptions.categoriesAccess?.read ?? anyone,
      update: pluginOptions.categoriesAccess?.update ?? authenticated,
    }

    const authorsEnabled = pluginOptions.authors === true

    const authorsAccess = {
      create: pluginOptions.authorsAccess?.create ?? authenticated,
      delete: pluginOptions.authorsAccess?.delete ?? authenticated,
      read: pluginOptions.authorsAccess?.read ?? anyone,
      update: pluginOptions.authorsAccess?.update ?? authenticated,
    }

    const editorFontSize = pluginOptions.editorFontSize ?? 'normal'
    const emphasizeEditorLinks = pluginOptions.emphasizeEditorLinks === true
    const useDefaultCategory = pluginOptions.useDefaultCategory !== false
    const usersSlug = pluginOptions.usersSlug ?? 'users'
    const editorUpdateAccess = pluginOptions.editorUpdateAccess ?? authenticatedField

    // A disabled plugin keeps its collections for schema consistency, but must
    // not act on them: revalidating from a plugin that is meant to be off would
    // be a side effect nobody asked for.
    const revalidate =
      pluginOptions.disabled || pluginOptions.revalidate === false
        ? false
        : (pluginOptions.revalidate ?? {})

    config.collections.push(Categories({ access: categoriesAccess, revalidate }))

    if (authorsEnabled) {
      config.collections.push(Authors({ access: authorsAccess, revalidate }))
    }

    config.collections.push(
      Articles({
        access,
        articleUrl,
        authors: authorsEnabled,
        editorFontSize,
        editorUpdateAccess,
        emphasizeEditorLinks,
        revalidate,
        seo: seoEnabled
          ? {
              hasGenerateDescription: true,
              hasGenerateImage: true,
              hasGenerateTitle: true,
            }
          : false,
        useDefaultCategory,
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
      // `seoPlugin` does two things at once: it registers the
      // /plugin-seo/generate-* endpoints the field buttons call, and it appends
      // its own `meta` group to every collection it is listed for. Articles
      // builds that group itself, so only the endpoints are wanted — but since
      // @payloadcms/plugin-seo 3.90.0 those endpoints authorize the request
      // against this very list and reject any slug missing from it, so the
      // collection has to be listed. It is, and the group it appends is then
      // dropped again by restoring the field list.
      const fieldsBefore = config.collections?.find(({ slug }) => slug === 'articles')?.fields

      config = seoPlugin({
        collections: ['articles'],
        generateDescription,
        generateImage,
        generateTitle,
        generateURL,
      })(config)

      const articles = config.collections?.find(({ slug }) => slug === 'articles')
      if (articles && fieldsBefore) {
        articles.fields = fieldsBefore
      }
    }

    return config
  }

export type { EditorFontSize, RevalidateEvent, RevalidateOptions, RevalidateProfile }
export type { VideoEmbed, VideoEmbedProvider }
export { parseVideoEmbedUrl, VIDEO_EMBED_BLOCK_SLUG }
export {
  articleIdTag,
  ARTICLES_TAG,
  articleTag,
  authorIdTag,
  AUTHORS_TAG,
  CATEGORIES_TAG,
  categoryIdTag,
  categoryTag,
} from './tags.js'

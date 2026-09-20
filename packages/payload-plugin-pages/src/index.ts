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
import type { Block, Config } from 'payload'

import {
  parseVideoEmbedUrl,
  VIDEO_EMBED_BLOCK_SLUG,
} from '@composius/payload-plugin-shared-components'
import { seoPlugin } from '@payloadcms/plugin-seo'

import type { BlockReference, PagesAccess } from './collections/Pages.js'

import { CONTENT_BLOCK_SLUG, contentBlock } from './blocks/content.js'
import { Pages } from './collections/Pages.js'
import {
  authenticated,
  authenticatedOrPublished,
  defaultGenerateDescription,
  defaultGenerateImage,
  defaultGenerateTitle,
  defaultGenerateURL,
  defaultPageUrl,
  withSiteName,
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
  blockReferences?: BlockReference[]
  /**
   * Blocks a page can be laid out with, defined inline on the `layout` field.
   * They join the content block the plugin contributes by default.
   */
  blocks?: Block[]
  /**
   * Where the prose of a page lives:
   *
   * - `'block'` (the default) — a content block, added to `layout` for you.
   *   Nothing to import: `contentBlock()` is exported only for hosts that want
   *   to place it themselves, or register it in `config.blocks`.
   * - `'field'` — a fixed `content` richText field on the document.
   * - `false` — neither; the layout is whatever you pass.
   *
   * Passing a block of your own under the `content` slug, inline or by
   * reference, replaces the built-in one rather than colliding with it.
   *
   * The block and the field store their text in different places, so moving
   * between them on a populated collection needs a migration.
   * @default 'block'
   */
  content?: 'block' | 'field' | false
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
   *
   * It reaches the built-in content block and the `content` field alike. A
   * content block the host defines itself is theirs to configure, through
   * `contentBlock({ fontSize })`.
   * @default 'normal'
   */
  editorFontSize?: EditorFontSize | false
  /**
   * Draws the links in the content editor blue and continuously underlined,
   * where Payload draws them green under a dotted border — more contrast
   * against the surrounding prose, so links are easier to pick out while
   * writing.
   *
   * CSS over the admin panel alone, scoped to this plugin's editor: nothing is
   * written to a node, so a front end styles its links however it already did.
   *
   * It reaches the built-in content block and the `content` field alike. A
   * content block the host defines itself is theirs to configure, through
   * `contentBlock({ emphasizeLinks })`.
   * @default false
   */
  emphasizeEditorLinks?: boolean
  /**
   * Builds the front-end URL of a page, used for admin preview and live preview.
   * Defaults to `${NEXT_PUBLIC_SERVER_URL || SERVER_URL || 'http://localhost:3000'}/${slug}`.
   */
  pageUrl?: (slug?: null | string) => string
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
}

/**
 * Puts a block on `config.blocks` and returns its slug, so a field can name it.
 * A slug already registered is left alone: the host's definition wins, and
 * Payload rejects a config that registers one slug twice.
 */
const registerBlock = (config: Config, block: Block): BlockReference => {
  config.blocks ??= []

  if (!config.blocks.some((registered) => registered.slug === block.slug)) {
    config.blocks.push(block)
  }

  return block.slug
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
    const generateTitle: GenerateTitle = withSiteName(
      seoOverrides.generateTitle ?? defaultGenerateTitle,
      seoOverrides.siteName,
    )
    const generateURL: GenerateURL = seoOverrides.generateURL ?? defaultGenerateURL(pageUrl)

    const content = pluginOptions.content ?? 'block'
    const editorFontSize = pluginOptions.editorFontSize ?? 'normal'
    const emphasizeEditorLinks = pluginOptions.emphasizeEditorLinks === true
    const givenReferences = pluginOptions.blockReferences ?? []
    const givenBlocks = pluginOptions.blocks ?? []

    // The built-in content block stands down for one the host defines under the
    // same slug: two blocks named `content` on one field is an error, and the
    // host's own definition is the one they meant to use.
    const claimsContentSlug = [...givenBlocks, ...givenReferences].some(
      (block) => (typeof block === 'string' ? block : block.slug) === CONTENT_BLOCK_SLUG,
    )

    const layoutBlocks =
      content === 'block' && !claimsContentSlug
        ? [
            contentBlock({ emphasizeLinks: emphasizeEditorLinks, fontSize: editorFontSize }),
            ...givenBlocks,
          ]
        : givenBlocks

    // `generate:importmap` walks `config.blocks` and a blocks field's `blocks`,
    // but never its `blockReferences` — a block object reachable only as a
    // reference contributes none of its components, and a richText inside it
    // fails at runtime with "PayloadComponent not found in importMap". So once
    // the field is in reference mode, every block object goes onto the config
    // and is named by slug, which the generator does follow.
    const references = givenReferences.length > 0
    const blocks = references ? [] : layoutBlocks
    const blockReferences = references
      ? [...givenReferences, ...layoutBlocks].map((block) =>
          typeof block === 'string' ? block : registerBlock(config, block),
        )
      : []

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
        blockReferences,
        blocks,
        contentField: content === 'field',
        editorFontSize,
        emphasizeEditorLinks,
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
      // `seoPlugin` does two things at once: it registers the
      // /plugin-seo/generate-* endpoints the field buttons call, and it appends
      // its own `meta` group to every collection it is listed for. Pages builds
      // that group itself, so only the endpoints are wanted — but since
      // @payloadcms/plugin-seo 3.90.0 those endpoints authorize the request
      // against this very list and reject any slug missing from it, so the
      // collection has to be listed. It is, and the group it appends is then
      // dropped again by restoring the field list.
      const fieldsBefore = config.collections.find(({ slug }) => slug === 'pages')?.fields

      config = seoPlugin({
        collections: ['pages'],
        generateDescription,
        generateImage,
        generateTitle,
        generateURL,
      })(config)

      const pages = config.collections?.find(({ slug }) => slug === 'pages')
      if (pages && fieldsBefore) {
        pages.fields = fieldsBefore
      }
    }

    return config
  }

export type { EditorFontSize, RevalidateEvent, RevalidateOptions, RevalidateProfile }
export type { VideoEmbed, VideoEmbedProvider }
export { parseVideoEmbedUrl, VIDEO_EMBED_BLOCK_SLUG }
export type { ContentBlockOptions } from './blocks/content.js'
export { CONTENT_BLOCK_SLUG, contentBlock } from './blocks/content.js'
export { pageIdTag, PAGES_TAG, pageTag } from './tags.js'

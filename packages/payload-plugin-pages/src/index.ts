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
import { contentBlock, CONTENT_BLOCK_SLUG } from './blocks/content.js'
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

/**
 * Puts a block on `config.blocks` and returns its slug, so a field can name it.
 * A slug already registered is left alone: the host's definition wins, and
 * Payload rejects a config that registers one slug twice.
 */
const registerBlock = (config: Config, block: Block): string => {
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
    const generateTitle: GenerateTitle = seoOverrides.generateTitle ?? defaultGenerateTitle
    const generateURL: GenerateURL = seoOverrides.generateURL ?? defaultGenerateURL(pageUrl)

    const content = pluginOptions.content ?? 'block'
    const givenReferences = pluginOptions.blockReferences ?? []
    const givenBlocks = pluginOptions.blocks ?? []

    // The built-in content block stands down for one the host defines under the
    // same slug: two blocks named `content` on one field is an error, and the
    // host's own definition is the one they meant to use.
    const claimsContentSlug = [...givenBlocks, ...givenReferences].some(
      (block) => (typeof block === 'string' ? block : block.slug) === CONTENT_BLOCK_SLUG,
    )

    const layoutBlocks =
      content === 'block' && !claimsContentSlug ? [contentBlock(), ...givenBlocks] : givenBlocks

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
export { contentBlock, CONTENT_BLOCK_SLUG } from './blocks/content.js'
export { pageIdTag, pageTag, PAGES_TAG } from './tags.js'

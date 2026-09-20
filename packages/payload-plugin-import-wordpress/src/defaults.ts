import type { Access } from 'payload'

import type { ComposiusPayloadPluginImportWordpressConfig, ResolvedOptions } from './types.js'

export const anyone: Access = () => true

export const authenticated: Access = ({ req: { user } }) => Boolean(user)

/** Relative, so rewritten links and redirect targets stay valid on any host. */
export const defaultArticleUrl = (slug?: null | string): string => `/articles/${slug ?? ''}`

/**
 * MIME types an image download may declare. Raster formats only: an SVG is a
 * document that can carry script, and the importer uploads what it fetches
 * under the type the source site claims for it.
 */
export const defaultAllowedImageMimeTypes = [
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]

/** Largest accepted image download, in bytes. */
export const defaultMaxImageBytes = 20 * 1024 * 1024

/** Slug of the collection storing import jobs (the "form" + report surface). */
export const JOBS_SLUG = 'wp-import-jobs'
/** Slug of the collection storing source→target mappings for idempotency. */
export const RECORDS_SLUG = 'wp-import-records'
/** Job task slug registered on the Payload jobs queue. */
export const TASK_SLUG = 'importWordpress'
/** Default slug of `@composius/payload-plugin-redirections`' collection. */
export const REDIRECTIONS_SLUG = 'redirections'

/** Resolves the `redirections` option (boolean shorthand or object) with defaults. */
const resolveRedirections = (
  option: ComposiusPayloadPluginImportWordpressConfig['redirections'],
): ResolvedOptions['redirections'] => {
  const value = typeof option === 'object' ? option : {}

  return {
    slug: value.slug ?? value.pluginOptions?.slug ?? REDIRECTIONS_SLUG,
    enabled: option !== false,
    manage: value.manage,
    pluginOptions: value.pluginOptions ?? {},
    status: value.status ?? '301',
    strategy: value.strategy ?? 'prefix',
  }
}

/** Merges user options with defaults into a fully-resolved options object. */
export const resolveOptions = (
  pluginOptions: ComposiusPayloadPluginImportWordpressConfig,
): ResolvedOptions => ({
  access: {
    create: pluginOptions.access?.create ?? authenticated,
    delete: pluginOptions.access?.delete ?? authenticated,
    read: pluginOptions.access?.read ?? authenticated,
    update: pluginOptions.access?.update ?? authenticated,
  },
  articleUrl: pluginOptions.articleUrl ?? defaultArticleUrl,
  authorMapping: {
    defaultUserId: pluginOptions.authorMapping?.defaultUserId,
    strategy: pluginOptions.authorMapping?.strategy ?? 'users',
    syntheticEmailDomain: pluginOptions.authorMapping?.syntheticEmailDomain ?? 'imported.invalid',
  },
  collections: {
    articles: pluginOptions.collections?.articles ?? 'articles',
    authors: pluginOptions.collections?.authors ?? 'authors',
    categories: pluginOptions.collections?.categories ?? 'categories',
    media: pluginOptions.collections?.media ?? 'media',
    users: pluginOptions.collections?.users ?? 'users',
  },
  dryRunPageLimit: pluginOptions.dryRunPageLimit ?? 1,
  excerptToSeoDescription: pluginOptions.excerptToSeoDescription ?? true,
  fieldMap: {
    slug: pluginOptions.fieldMap?.slug ?? 'slug',
    category: pluginOptions.fieldMap?.category ?? 'category',
    content: pluginOptions.fieldMap?.content ?? 'content',
    coverImage: pluginOptions.fieldMap?.coverImage ?? 'coverImage',
    publishedAt: pluginOptions.fieldMap?.publishedAt ?? 'publishedAt',
    title: pluginOptions.fieldMap?.title ?? 'title',
  },
  firstImageAsCover: pluginOptions.firstImageAsCover ?? true,
  redirections: resolveRedirections(pluginOptions.redirections),
  request: {
    allowedMimeTypes: pluginOptions.request?.allowedMimeTypes ?? defaultAllowedImageMimeTypes,
    concurrency: pluginOptions.request?.concurrency ?? 5,
    maxBytes: pluginOptions.request?.maxBytes ?? defaultMaxImageBytes,
    timeoutMs: pluginOptions.request?.timeoutMs ?? 30000,
    userAgent: pluginOptions.request?.userAgent,
  },
})

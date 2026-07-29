import type { Access } from 'payload'

import type { ComposiusPayloadPluginImportWordpressConfig, ResolvedOptions } from './types.js'

export const anyone: Access = () => true

export const authenticated: Access = ({ req: { user } }) => Boolean(user)

/** Relative, so rewritten links and redirect targets stay valid on any host. */
export const defaultArticleUrl = (slug?: null | string): string => `/articles/${slug ?? ''}`

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
    enabled: option !== false,
    manage: value.manage,
    pluginOptions: value.pluginOptions ?? {},
    slug: value.slug ?? value.pluginOptions?.slug ?? REDIRECTIONS_SLUG,
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
    strategy: pluginOptions.authorMapping?.strategy ?? 'users',
    defaultUserId: pluginOptions.authorMapping?.defaultUserId,
    syntheticEmailDomain: pluginOptions.authorMapping?.syntheticEmailDomain ?? 'imported.invalid',
  },
  collections: {
    articles: pluginOptions.collections?.articles ?? 'articles',
    categories: pluginOptions.collections?.categories ?? 'categories',
    media: pluginOptions.collections?.media ?? 'media',
    authors: pluginOptions.collections?.authors ?? 'authors',
    users: pluginOptions.collections?.users ?? 'users',
  },
  dryRunPageLimit: pluginOptions.dryRunPageLimit ?? 1,
  excerptToSeoDescription: pluginOptions.excerptToSeoDescription ?? true,
  firstImageAsCover: pluginOptions.firstImageAsCover ?? true,
  fieldMap: {
    title: pluginOptions.fieldMap?.title ?? 'title',
    slug: pluginOptions.fieldMap?.slug ?? 'slug',
    content: pluginOptions.fieldMap?.content ?? 'content',
    coverImage: pluginOptions.fieldMap?.coverImage ?? 'coverImage',
    category: pluginOptions.fieldMap?.category ?? 'category',
    publishedAt: pluginOptions.fieldMap?.publishedAt ?? 'publishedAt',
  },
  redirections: resolveRedirections(pluginOptions.redirections),
  request: {
    concurrency: pluginOptions.request?.concurrency ?? 5,
    timeoutMs: pluginOptions.request?.timeoutMs ?? 30000,
    userAgent: pluginOptions.request?.userAgent,
  },
})

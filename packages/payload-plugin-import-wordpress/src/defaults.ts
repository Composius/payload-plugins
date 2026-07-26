import type { Access } from 'payload'

import type { ComposiusPayloadPluginImportWordpressConfig, ResolvedOptions } from './types.js'

export const anyone: Access = () => true

export const authenticated: Access = ({ req: { user } }) => Boolean(user)

export const defaultArticleUrl = (slug?: null | string): string =>
  `${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}/articles/${slug ?? ''}`

/** Slug of the collection storing import jobs (the "form" + report surface). */
export const JOBS_SLUG = 'wp-import-jobs'
/** Slug of the collection storing source→target mappings for idempotency. */
export const RECORDS_SLUG = 'wp-import-records'
/** Job task slug registered on the Payload jobs queue. */
export const TASK_SLUG = 'importWordpress'

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
  redirects: {
    enabled: pluginOptions.redirects !== false,
    manage:
      typeof pluginOptions.redirects === 'object' ? pluginOptions.redirects.manage : undefined,
    pluginOptions:
      (typeof pluginOptions.redirects === 'object'
        ? pluginOptions.redirects.pluginOptions
        : undefined) ?? {},
  },
  request: {
    concurrency: pluginOptions.request?.concurrency ?? 5,
    timeoutMs: pluginOptions.request?.timeoutMs ?? 30000,
    userAgent: pluginOptions.request?.userAgent,
  },
})

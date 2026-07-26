import type { Access } from 'payload'

export type ImportAccess = {
  create?: Access
  delete?: Access
  read?: Access
  update?: Access
}

/** Slugs of the collections the import writes into. */
export type TargetCollections = {
  /** Target content collection for posts. @default 'articles' */
  articles?: string
  /** Taxonomy collection for categories. @default 'categories' */
  categories?: string
  /** Uploads collection for images. @default 'media' */
  media?: string
  /** Authors collection (used when `authorMapping.strategy` is `'authors'`). @default 'authors' */
  authors?: string
  /** Users collection (used when `authorMapping.strategy` is `'users'`). @default 'users' */
  users?: string
}

export type AuthorStrategy = 'authors' | 'fixed' | 'users'

export type AuthorMapping = {
  /**
   * How WordPress authors are mapped:
   * - `users` (default): find-or-create in the users collection (matched by email),
   *   linked via the article `editor` field.
   * - `authors`: create in the authors collection, linked via the article `author` field
   *   (requires the articles plugin to be configured with `authors: true`).
   * - `fixed`: assign every imported article to `defaultUserId`.
   */
  strategy?: AuthorStrategy
  /** User id assigned when `strategy` is `fixed` (or as a fallback when an author has no email). */
  defaultUserId?: number | string
  /**
   * The public WordPress REST API does not expose author emails, so with the
   * `users` strategy an email is synthesized as `<author-slug>@<domain>`.
   * Configure the domain here, or pass `false` to skip creating users without
   * a real email — the article then falls back to `defaultUserId` (or no
   * editor) and the skipped author is listed in the report.
   * @default 'imported.invalid' (a reserved TLD that can never be a real address)
   */
  syntheticEmailDomain?: false | string
}

export type RedirectionStatus = '301' | '302' | '307' | '308'

/**
 * Subset of `ComposiusPayloadPluginRedirectionsConfig`, declared structurally
 * so the type doesn't depend on that optional peer.
 */
export type RedirectionsPluginOptions = {
  access?: Record<string, unknown>
  endpoint?: false | Record<string, unknown>
  hidden?: boolean | ((args: { user: unknown }) => boolean)
  slug?: string
}

export type RedirectionsConfig = {
  /**
   * Whether this plugin registers the redirections collection (via
   * `@composius/payload-plugin-redirections`).
   *
   * By default this is auto-detected: if the collection is already registered —
   * because your app runs `ComposiusPayloadPluginRedirections` earlier in the
   * `plugins` array — it is reused as-is and nothing is added. Set to `false`
   * when your own redirections plugin is listed *after* this plugin, so the
   * collection isn't registered twice (`DuplicateCollection`).
   *
   * Either way, imported posts still get their redirection rules.
   */
  manage?: boolean
  /**
   * Options forwarded to `ComposiusPayloadPluginRedirections` when this plugin
   * registers the collection.
   */
  pluginOptions?: RedirectionsPluginOptions
  /** Slug of the redirections collection. @default 'redirections' */
  slug?: string
  /** HTTP status of the created rules. @default '301' */
  status?: RedirectionStatus
  /**
   * How rules are generated from the imported permalinks:
   * - `prefix` (default): one **prefix** rule per distinct permalink folder
   *   (`/blog/<slug>` → a single `/blog` → `/articles` rule covering every post
   *   under it), falling back to an exact rule for permalinks that don't fit
   *   (a changed slug, or a permalink at the site root — a prefix rule on `/`
   *   would swallow the whole site).
   * - `exact`: one rule per imported post.
   */
  strategy?: 'exact' | 'prefix'
}

export type AutoRunConfig = {
  /** Cron expression for the auto-run schedule. @default '* * * * *' (every minute) */
  cron?: string
  /** Queue processed by the schedule. @default 'default' */
  queue?: string
}

export type FieldMap = {
  /** Article field the post title maps to. @default 'title' */
  title?: string
  /** Article field the post slug maps to. @default 'slug' */
  slug?: string
  /** Article rich text field the post content maps to. @default 'content' */
  content?: string
  /** Article upload field the featured image maps to. @default 'coverImage' */
  coverImage?: string
  /** Article relationship field the primary category maps to. @default 'category' */
  category?: string
  /** Article date field the publish date maps to. @default 'publishedAt' */
  publishedAt?: string
}

export type RequestOptions = {
  /** Per-image download concurrency. @default 5 */
  concurrency?: number
  /** Per-request timeout in ms. @default 30000 */
  timeoutMs?: number
  /** User-Agent header sent to WordPress. */
  userAgent?: string
}

export type ComposiusPayloadPluginImportWordpressConfig = {
  /**
   * Access control for the import jobs/records collections, per operation.
   * Defaults: `read`/`create`/`update`/`delete` require an authenticated user.
   */
  access?: ImportAccess
  /** Target collection slugs. Defaults: articles/categories/media/authors/users. */
  collections?: TargetCollections
  /**
   * Builds the front-end URL of an imported article from its slug. Used to
   * rewrite internal links and as the target of created redirects.
   * @default `${NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}/articles/${slug}`
   */
  articleUrl?: (slug?: null | string) => string
  /** How WordPress authors are mapped. @default { strategy: 'users' } */
  authorMapping?: AuthorMapping
  /** Map the WordPress excerpt onto the article SEO meta.description. @default true */
  excerptToSeoDescription?: boolean
  /**
   * When a post has no usable featured image, promote the first in-content
   * image to the cover field and remove it from the content (themes often lead
   * the content with the hero image instead of setting `featured_media`).
   * @default true
   */
  firstImageAsCover?: boolean
  /**
   * Create redirection rules from the old WordPress permalinks to the new
   * article URLs, preferring one **prefix** rule per permalink folder over one
   * rule per post. The collection comes from
   * `@composius/payload-plugin-redirections`, which this plugin applies unless
   * your app already registers it (auto-detected). Pass an object to control
   * that, or `false` to skip redirections entirely.
   * @default true
   */
  redirections?: boolean | RedirectionsConfig
  /** Override the article field names the importer writes to. */
  fieldMap?: FieldMap
  /**
   * Automatically process queued imports on a schedule so creating a job runs
   * it without an external worker. Pass a cron/queue config to customize the
   * schedule, or `false` to disable it and run the jobs queue yourself.
   * @default true (an every-minute schedule on the `default` queue)
   */
  autoRun?: AutoRunConfig | boolean
  /** Number of REST pages a dry run samples. @default 1 */
  dryRunPageLimit?: number
  /** HTTP request tuning for WordPress fetches and image downloads. */
  request?: RequestOptions
  disabled?: boolean
}

/** Fully-resolved options passed around internally. */
export type ResolvedOptions = {
  access: Required<ImportAccess>
  articleUrl: (slug?: null | string) => string
  authorMapping: Required<Pick<AuthorMapping, 'strategy' | 'syntheticEmailDomain'>> &
    Pick<AuthorMapping, 'defaultUserId'>
  collections: Required<TargetCollections>
  dryRunPageLimit: number
  excerptToSeoDescription: boolean
  fieldMap: Required<FieldMap>
  firstImageAsCover: boolean
  redirections: {
    enabled: boolean
    /** `undefined` = auto-detect whether the collection is already registered. */
    manage?: boolean
    pluginOptions: RedirectionsPluginOptions
    slug: string
    status: RedirectionStatus
    strategy: 'exact' | 'prefix'
  }
  request: Required<Omit<RequestOptions, 'userAgent'>> & Pick<RequestOptions, 'userAgent'>
}

// ---- Report / progress shapes stored on the wp-import-jobs document ----

export type ImportedItem = {
  /** Number of the job run that imported this item. */
  run?: number
  slug?: string
  sourceId: number
  targetId: number | string
  title?: string
}

export type LinkAction = 'redirect' | 'rewritten' | 'unresolved'

export type LinkMapping = {
  action: LinkAction
  /** For `redirect` entries: how many imported posts the rule covers. */
  covers?: number
  from: string
  /** For `redirect` entries: how the rule matches the incoming path. */
  matchType?: 'exact' | 'prefix'
  post?: number
  /** Number of the job run that handled this link. */
  run?: number
  to?: string
}

export type ImportError = {
  message: string
  /** Number of the job run that hit this error. */
  run?: number
  scope: string
  sourceId?: number
}

/** One entry of a job's run history (a job can run several times via resume/retry). */
export type RunSummary = {
  dryRun: boolean
  finishedAt?: string
  /** Final progress snapshot of the run. */
  progress?: ImportProgress
  run: number
  startedAt: string
  status: 'completed' | 'failed' | 'running'
}

export type ImportReport = {
  dryRun: boolean
  errors: ImportError[]
  imported: {
    authors: ImportedItem[]
    categories: ImportedItem[]
    media: ImportedItem[]
    posts: ImportedItem[]
  }
  links: LinkMapping[]
  remaining: {
    posts: number
  }
}

export type ImportProgress = {
  currentPhase: string
  cursorPage: number
  importedAuthors: number
  importedCategories: number
  importedMedia: number
  importedPosts: number
  linksRewritten: number
  linksUnresolved: number
  redirectsCreated: number
  reusedMedia: number
  skippedPosts: number
  failedPosts: number
  totalPosts: number
}

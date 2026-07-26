import type { Payload } from 'payload'

import type { ImportProgress, ImportReport, ResolvedOptions, RunSummary } from '../types.js'
import type { ImageImportResult } from '../lib/media.js'
import type { PersistedJobReports } from '../lib/report.js'
import type { WPPost, WPUser } from '../lib/wpTypes.js'

import { JOBS_SLUG } from '../defaults.js'
import { resolveAuthor } from '../lib/authors.js'
import { importCategories } from '../lib/categories.js'
import { buildContent } from '../lib/content.js'
import { coerceId } from '../lib/id.js'
import { resolveEditorConfig } from '../lib/editorConfig.js'
import { importImage } from '../lib/media.js'
import { removeLeadingUploadNode, takeFirstUploadNode } from '../lib/lexical.js'
import { createDoc, findDoc, findDocs, updateDoc } from '../lib/payloadOps.js'
import { publishDate, selectPrimaryCategoryId } from '../lib/post.js'
import { createRedirect } from '../lib/redirects.js'
import { emptyProgress, rehydrateReport } from '../lib/report.js'
import { findDoneRecord, saveRecord } from '../lib/records.js'
import { createWPClient } from '../lib/wpClient.js'
import { decodeEntities, hostOf, pathOf, permalinkToSlug, stripHtml } from '../lib/url.js'

const PER_PAGE = 100
// Matches SEO_DESCRIPTION_MAX_LENGTH in the shared-components SEO defaults.
const SEO_DESCRIPTION_MAX = 150

export type RunImportArgs = {
  fetchImpl?: typeof fetch
  jobId: number | string
  options: ResolvedOptions
}

type JobDoc = PersistedJobReports & {
  credentials?: null | { applicationPassword?: null | string; username?: null | string }
  dateFrom?: null | string
  dateTo?: null | string
  dryRun?: boolean | null
  limit?: null | number
  sourceUrl: string
}

/**
 * Executes one import run for a `wp-import-jobs` document. Idempotent and
 * resumable: every entity is checked against `wp-import-records` and skipped if
 * already imported, and writes intentionally omit `req` so each commits
 * independently. In dry-run mode it samples the first page(s) and writes
 * nothing, producing the same report describing what a real run would do.
 */
export const runImport = async (payload: Payload, args: RunImportArgs): Promise<ImportReport> => {
  const { options } = args
  const { collections: slugs } = options
  const progress: ImportProgress = emptyProgress()

  const job = (await findDoc(payload, {
    collection: JOBS_SLUG,
    id: args.jobId,
    depth: 0,
  })) as unknown as JobDoc

  const dryRun = Boolean(job.dryRun)
  // Resume/retry: start from what earlier runs reported (dry-run entries are
  // dropped), and tag everything new with this run's number.
  const { previousRuns, report, runNumber } = rehydrateReport(job, dryRun)
  const runSummary: RunSummary = {
    dryRun,
    run: runNumber,
    startedAt: new Date().toISOString(),
    status: 'running',
  }
  const runs: RunSummary[] = [...previousRuns, runSummary]
  const site = hostOf(job.sourceUrl) ?? job.sourceUrl
  const imageCache = new Map<string, ImageImportResult>()

  // Per-step report slices, persisted onto the job's step tabs.
  const stepReports = (): Record<string, unknown> => ({
    authorsReport: { imported: report.imported.authors },
    categoriesReport: { imported: report.imported.categories },
    errorsReport: { dryRun: report.dryRun, errors: report.errors },
    linksReport: { links: report.links },
    mediaReport: { imported: report.imported.media, reused: progress.reusedMedia },
    postsReport: {
      dryRun: report.dryRun,
      imported: report.imported.posts,
      remaining: report.remaining.posts,
    },
    runs,
  })

  const updateJob = async (data: Record<string, unknown>): Promise<void> => {
    await updateDoc(payload, {
      collection: JOBS_SLUG,
      id: args.jobId,
      data,
      context: { wpImport: true },
    })
  }

  const accountImage = (result: ImageImportResult, sourceId: number): void => {
    if (result.error) {
      report.errors.push({ message: result.error, run: runNumber, scope: 'media', sourceId })
    } else if (result.uploaded) {
      progress.importedMedia += 1
      report.imported.media.push({
        run: runNumber,
        sourceId,
        targetId: result.mediaId ?? 'dry-run',
      })
    } else if (result.reused) {
      progress.reusedMedia += 1
    }
  }

  try {
    progress.currentPhase = 'running'
    await updateJob({
      status: 'running',
      startedAt: new Date().toISOString(),
      progress,
      ...stepReports(),
    })

    const editorConfig = await resolveEditorConfig(payload, slugs.articles, options.fieldMap.content)
    const client = createWPClient(
      job.sourceUrl,
      {
        credentials: job.credentials,
        timeoutMs: options.request.timeoutMs,
        userAgent: options.request.userAgent,
      },
      args.fetchImpl,
    )

    // ---- Categories (full hierarchy) ----
    progress.currentPhase = 'categories'
    const wpCategories = await client.fetchCategories()
    const categoriesResult = await importCategories(payload, {
      categories: wpCategories,
      categoriesSlug: slugs.categories,
      dryRun,
      jobId: args.jobId,
      site,
    })
    const categoryIdMap = categoriesResult.idMap
    report.imported.categories.push(
      ...categoriesResult.imported.map((item) => ({ ...item, run: runNumber })),
    )
    report.errors.push(...categoriesResult.errors.map((error) => ({ ...error, run: runNumber })))
    progress.importedCategories = categoriesResult.imported.length
    await updateJob({ progress, ...stepReports() })

    // ---- Gather posts (two-pass: collect for full link resolution, then import) ----
    progress.currentPhase = 'posts'
    const after = job.dateFrom ? new Date(job.dateFrom).toISOString() : undefined
    const before = job.dateTo ? new Date(job.dateTo).toISOString() : undefined
    const maxPages = dryRun ? options.dryRunPageLimit : Number.POSITIVE_INFINITY
    const limit = job.limit ?? undefined

    const gathered: WPPost[] = []
    let page = 1
    let totalPages = 1
    do {
      const { posts, totalPages: tp } = await client.fetchPostsPage({ after, before, page, perPage: PER_PAGE })
      totalPages = tp
      gathered.push(...posts)
      progress.cursorPage = page
      page += 1
    } while (page <= totalPages && page <= maxPages && (!limit || gathered.length < limit))

    const postsToImport = limit ? gathered.slice(0, limit) : gathered
    progress.totalPosts = postsToImport.length

    // Known slugs (this run + already-imported) for internal-link resolution.
    const existingArticles = await findDocs(payload, {
      collection: slugs.articles,
      depth: 0,
      limit: 100000,
      select: { slug: true },
    })
    const knownSlugs = new Set<string>(
      existingArticles.docs.map((d) => (d as { slug?: string }).slug).filter(Boolean) as string[],
    )
    const slugByPath = new Map<string, string>()
    for (const p of postsToImport) {
      if (p.slug) {
        knownSlugs.add(p.slug)
        if (p.link) {
          slugByPath.set(pathOf(p.link), p.slug)
        }
      }
    }
    const resolveInternal = (url: string, slug: null | string): null | string => {
      const byPath = slugByPath.get(pathOf(url))
      if (byPath) {
        return byPath
      }
      const candidate = slug ?? permalinkToSlug(url)
      return candidate && knownSlugs.has(candidate) ? candidate : null
    }

    // With credentials, author details (incl. email) can be fetched via
    // ?context=edit — cached per WP user id across posts.
    const authorDetailCache = new Map<number, null | WPUser>()
    const enrichAuthor = async (embedded?: WPUser): Promise<undefined | WPUser> => {
      if (!embedded || embedded.email || !client.authenticated) {
        return embedded
      }
      if (!authorDetailCache.has(embedded.id)) {
        authorDetailCache.set(embedded.id, await client.fetchUser(embedded.id))
      }
      const detailed = authorDetailCache.get(embedded.id)
      return detailed?.email ? { ...embedded, email: detailed.email } : embedded
    }

    // ---- Import posts ----
    for (const post of postsToImport) {
      const permalinkPath = post.link ? pathOf(post.link) : `/?p=${post.id}`
      try {
        const already = await findDoneRecord(payload, { site, sourceId: post.id, sourceType: 'post' })
        if (already) {
          progress.skippedPosts += 1
          continue
        }

        // Featured image. Embeds can be stripped or error stubs (deleted or
        // private media), so fall back to the media endpoint.
        let coverId: null | string = null
        let featured = post._embedded?.['wp:featuredmedia']?.[0]
        if (!featured?.source_url && post.featured_media) {
          featured = (await client.fetchMedia(post.featured_media)) ?? undefined
        }
        if (featured?.source_url) {
          const result = await importImage(payload, {
            alt: featured.alt_text,
            cache: imageCache,
            dryRun,
            fetchImpl: args.fetchImpl,
            jobId: args.jobId,
            mediaSlug: slugs.media,
            site,
            sourceId: featured.id,
            timeoutMs: options.request.timeoutMs,
            url: featured.source_url,
          })
          coverId = result.mediaId
          accountImage(result, featured.id)
        }

        // Content: images + internal links.
        const built = await buildContent({
          articleUrl: options.articleUrl,
          editorConfig,
          html: post.content?.rendered ?? '',
          importContentImage: (src) =>
            importImage(payload, {
              cache: imageCache,
              dryRun,
              fetchImpl: args.fetchImpl,
              jobId: args.jobId,
              mediaSlug: slugs.media,
              site,
              timeoutMs: options.request.timeoutMs,
              url: src,
            }),
          mediaSlug: slugs.media,
          resolveInternal,
          siteHost: site,
        })
        for (const img of built.images) {
          accountImage(img.result, post.id)
        }
        report.links.push(...built.links.map((link) => ({ ...link, run: runNumber })))
        for (const link of built.links) {
          if (link.action === 'rewritten') {
            progress.linksRewritten += 1
          } else if (link.action === 'unresolved') {
            progress.linksUnresolved += 1
          }
        }

        // Cover handling: promote the first content image when there is no
        // featured image, and drop a leading duplicate of the cover so the
        // hero doesn't render twice.
        if (!coverId && options.firstImageAsCover) {
          const promoted = takeFirstUploadNode(built.content.root)
          if (promoted != null) {
            coverId = String(promoted)
          }
        } else if (coverId) {
          removeLeadingUploadNode(built.content.root, coverId)
        }

        // Author.
        const {
          author,
          imported: importedAuthor,
          skippedNoEmail,
        } = await resolveAuthor(payload, {
          authorsSlug: slugs.authors,
          defaultUserId: options.authorMapping.defaultUserId,
          dryRun,
          fetchImpl: args.fetchImpl,
          imageCache,
          jobId: args.jobId,
          mediaSlug: slugs.media,
          site,
          strategy: options.authorMapping.strategy,
          syntheticEmailDomain: options.authorMapping.syntheticEmailDomain,
          timeoutMs: options.request.timeoutMs,
          usersSlug: slugs.users,
          wpUser: await enrichAuthor(post._embedded?.author?.[0]),
        })
        if (importedAuthor) {
          progress.importedAuthors += 1
          report.imported.authors.push({ ...importedAuthor, run: runNumber })
        }
        if (
          skippedNoEmail &&
          !report.errors.some(
            (e) => e.scope === 'author' && e.sourceId === skippedNoEmail.sourceId,
          )
        ) {
          report.errors.push({
            message: `author "${skippedNoEmail.name}" has no email exposed by WordPress; user creation skipped (set authorMapping.syntheticEmailDomain or defaultUserId)`,
            run: runNumber,
            scope: 'author',
            sourceId: skippedNoEmail.sourceId,
          })
        }

        // Assemble article data.
        const title = decodeEntities(post.title?.rendered ?? post.slug ?? `post-${post.id}`)
        const primaryCategory = selectPrimaryCategoryId(post)
        const categoryId = primaryCategory != null ? categoryIdMap.get(primaryCategory) : undefined
        const data: Record<string, unknown> = {
          [options.fieldMap.title]: title,
          [options.fieldMap.content]: built.content,
          _status: 'published',
        }
        if (post.slug) {
          data[options.fieldMap.slug] = post.slug
        }
        if (coverId) {
          data[options.fieldMap.coverImage] = coerceId(coverId)
        }
        if (categoryId != null) {
          data[options.fieldMap.category] = coerceId(categoryId)
        }
        const date = publishDate(post)
        if (date) {
          data[options.fieldMap.publishedAt] = date
        }
        if (author) {
          data[author.field] = coerceId(author.value)
        }
        // SEO meta: title from the post title, image from the cover image,
        // description from the excerpt (when enabled). Silently ignored by
        // Payload when the target collection has no `meta` group.
        const meta: Record<string, unknown> = { title }
        if (coverId) {
          meta.image = coerceId(coverId)
        }
        if (options.excerptToSeoDescription && post.excerpt?.rendered) {
          meta.description = stripHtml(post.excerpt.rendered).slice(0, SEO_DESCRIPTION_MAX)
        }
        data.meta = meta

        if (dryRun) {
          report.imported.posts.push({
            run: runNumber,
            slug: post.slug,
            sourceId: post.id,
            targetId: 'dry-run',
            title,
          })
          progress.importedPosts += 1
          continue
        }

        const created = await createDoc(payload, {
          collection: slugs.articles,
          data,
        })
        const articleId = created.id
        await saveRecord(payload, {
          jobId: args.jobId,
          site,
          sourceId: post.id,
          sourceKey: permalinkPath,
          sourceType: 'post',
          targetCollection: slugs.articles,
          targetId: articleId,
        })
        report.imported.posts.push({
          run: runNumber,
          slug: post.slug,
          sourceId: post.id,
          targetId: articleId,
          title,
        })
        progress.importedPosts += 1

        // Redirect old permalink → new article.
        if (options.redirects.enabled) {
          const made = await createRedirect(payload, {
            articleId: coerceId(articleId),
            articlesSlug: slugs.articles,
            from: permalinkPath,
          })
          if (made) {
            progress.redirectsCreated += 1
            report.links.push({
              action: 'redirect',
              from: permalinkPath,
              run: runNumber,
              to: options.articleUrl(post.slug),
            })
          }
        }

        if (progress.importedPosts % 5 === 0) {
          await updateJob({ progress, ...stepReports() })
        }
      } catch (error) {
        progress.failedPosts += 1
        const message = error instanceof Error ? error.message : String(error)
        report.errors.push({ message, run: runNumber, scope: 'post', sourceId: post.id })
        if (!dryRun) {
          await saveRecord(payload, {
            error: message,
            jobId: args.jobId,
            site,
            sourceId: post.id,
            sourceType: 'post',
            status: 'failed',
          }).catch(() => undefined)
        }
      }
    }

    report.remaining.posts = Math.max(0, gathered.length - postsToImport.length)
    progress.currentPhase = 'done'
    runSummary.finishedAt = new Date().toISOString()
    runSummary.progress = { ...progress }
    runSummary.status = 'completed'
    await updateJob({
      finishedAt: runSummary.finishedAt,
      progress,
      status: 'completed',
      ...stepReports(),
    })
    return report
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    report.errors.push({ message, run: runNumber, scope: 'run' })
    progress.currentPhase = 'failed'
    runSummary.finishedAt = new Date().toISOString()
    runSummary.progress = { ...progress }
    runSummary.status = 'failed'
    await updateJob({
      finishedAt: runSummary.finishedAt,
      progress,
      status: 'failed',
      ...stepReports(),
    })
    return report
  }
}

import type {
  ImportedItem,
  ImportError,
  ImportProgress,
  ImportReport,
  LinkMapping,
  RunSummary,
} from '../types.js'

export const emptyProgress = (): ImportProgress => ({
  currentPhase: 'queued',
  cursorPage: 0,
  importedAuthors: 0,
  importedCategories: 0,
  importedMedia: 0,
  importedPosts: 0,
  linksRewritten: 0,
  linksUnresolved: 0,
  redirectsCreated: 0,
  reusedMedia: 0,
  skippedPosts: 0,
  failedPosts: 0,
  totalPosts: 0,
})

export const emptyReport = (dryRun: boolean): ImportReport => ({
  dryRun,
  errors: [],
  imported: { authors: [], categories: [], media: [], posts: [] },
  links: [],
  remaining: { posts: 0 },
})

/** Shape of the report fields persisted on a `wp-import-jobs` document. */
export type PersistedJobReports = {
  authorsReport?: null | { imported?: ImportedItem[] }
  categoriesReport?: null | { imported?: ImportedItem[] }
  errorsReport?: null | { errors?: ImportError[] }
  linksReport?: null | { links?: LinkMapping[] }
  mediaReport?: null | { imported?: ImportedItem[] }
  postsReport?: null | { imported?: ImportedItem[] }
  runs?: null | RunSummary[]
}

/**
 * Rebuilds the in-memory report from a job's persisted step reports, so a
 * resume/retry keeps the history of what earlier runs imported. Entries tagged
 * with a dry run are dropped (they were plans, not imports), and the next run
 * number is derived from the run history.
 */
export const rehydrateReport = (
  job: PersistedJobReports,
  dryRun: boolean,
): { previousRuns: RunSummary[]; report: ImportReport; runNumber: number } => {
  const previousRuns = Array.isArray(job.runs) ? job.runs : []
  const dryRunNumbers = new Set(previousRuns.filter((r) => r.dryRun).map((r) => r.run))
  const keep = <T extends { run?: number }>(items?: null | T[]): T[] =>
    (items ?? []).filter((item) => item.run === undefined || !dryRunNumbers.has(item.run))

  const report = emptyReport(dryRun)
  report.imported.authors = keep(job.authorsReport?.imported)
  report.imported.categories = keep(job.categoriesReport?.imported)
  report.imported.media = keep(job.mediaReport?.imported)
  report.imported.posts = keep(job.postsReport?.imported)
  report.links = keep(job.linksReport?.links)
  report.errors = keep(job.errorsReport?.errors)

  const runNumber = previousRuns.reduce((max, r) => Math.max(max, r.run), 0) + 1
  return { previousRuns, report, runNumber }
}

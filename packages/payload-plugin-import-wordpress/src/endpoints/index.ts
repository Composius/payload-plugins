import type { Endpoint, PayloadRequest } from 'payload'

import { APIError } from 'payload'

import type { ImportAccess } from '../types.js'

import { JOBS_SLUG } from '../defaults.js'

type StartBody = {
  dateFrom?: string
  dateTo?: string
  dryRun?: boolean
  limit?: number
  sourceUrl?: string
}

/** Runs a per-operation access function and throws 403 when it denies. */
const assertAccess = async (
  access: Required<ImportAccess>,
  operation: 'create' | 'read',
  req: PayloadRequest,
): Promise<void> => {
  const result = await access[operation]({ req } as Parameters<Required<ImportAccess>['read']>[0])
  if (!result) {
    throw new APIError('Forbidden', 403)
  }
}

/**
 * POST /api/wp-import/start — creates a `wp-import-jobs` document (which queues
 * the import via its afterChange hook) and returns the job id. Gated by the
 * plugin's `access.create` option, and again by the collection's create access
 * via `overrideAccess: false`.
 */
export const startEndpoint = (access: Required<ImportAccess>): Endpoint => ({
  path: '/wp-import/start',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      throw new APIError('Unauthorized', 401)
    }
    await assertAccess(access, 'create', req)

    const body = ((await req.json?.()) ?? {}) as StartBody
    if (!body.sourceUrl) {
      return Response.json({ error: 'sourceUrl is required' }, { status: 400 })
    }

    const job = await req.payload.create({
      collection: JOBS_SLUG,
      data: {
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
        dryRun: body.dryRun ?? false,
        limit: body.limit,
        sourceUrl: body.sourceUrl,
      },
      overrideAccess: false,
      req,
      user: req.user,
    })

    return Response.json({ jobId: job.id }, { status: 202 })
  },
})

/**
 * GET /api/wp-import/status/:id — returns the job's status, progress and report.
 * Gated by the plugin's `access.read` option and the collection's read access.
 */
export const statusEndpoint = (access: Required<ImportAccess>): Endpoint => ({
  path: '/wp-import/status/:id',
  method: 'get',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      throw new APIError('Unauthorized', 401)
    }
    await assertAccess(access, 'read', req)

    const id = req.routeParams?.id as number | string
    const job = (await req.payload.findByID({
      collection: JOBS_SLUG,
      id,
      overrideAccess: false,
      req,
      user: req.user,
    })) as unknown as Record<string, unknown>

    return Response.json({
      progress: job.progress,
      report: {
        authors: job.authorsReport,
        categories: job.categoriesReport,
        errors: job.errorsReport,
        links: job.linksReport,
        media: job.mediaReport,
        posts: job.postsReport,
      },
      runs: job.runs,
      status: job.status,
    })
  },
})

import type { TaskConfig } from 'payload'

import type { ResolvedOptions } from '../types.js'

import { TASK_SLUG } from '../defaults.js'
import { runImport } from './runImport.js'

/**
 * Registers the `importWordpress` jobs-queue task. The handler is thin — it
 * loads the job document (by id) and delegates to `runImport`, which owns all
 * fetching, transformation, idempotency and reporting.
 */
export const importWordpressTask = (options: ResolvedOptions): TaskConfig<'inline'> =>
  ({
    slug: TASK_SLUG,
    handler: async ({ input, req }: { input: { jobId: number | string }; req: { payload: import('payload').Payload } }) => {
      await runImport(req.payload, { jobId: input.jobId, options })
      return { output: {} }
    },
    inputSchema: [{ name: 'jobId', type: 'text', required: true }],
  }) as unknown as TaskConfig<'inline'>

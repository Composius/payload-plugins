import type { Config } from 'payload'

import type { ComposiusPayloadPluginImportWordpressConfig } from './types.js'

import { ImportJobs } from './collections/ImportJobs.js'
import { ImportRecords } from './collections/ImportRecords.js'
import { resolveOptions } from './defaults.js'
import { startEndpoint, statusEndpoint } from './endpoints/index.js'
import { importWordpressTask } from './jobs/task.js'

export type { ComposiusPayloadPluginImportWordpressConfig } from './types.js'
export type { ImportProgress, ImportReport } from './types.js'

const LOG_PREFIX = '@composius/payload-plugin-import-wordpress'

/**
 * Imports WordPress posts (via the REST API) into a target content collection —
 * by default the `@composius/payload-plugin-articles` `articles` collection —
 * along with their categories, authors, featured and in-content images. Images
 * are uploaded once and resized by the media collection; internal links are
 * rewritten and the rest get 301 redirects. Runs on the jobs queue and is
 * idempotent + resumable, writing a full report onto each job document.
 */
export const ComposiusPayloadPluginImportWordpress =
  (pluginOptions: ComposiusPayloadPluginImportWordpressConfig = {}) =>
  async (config: Config): Promise<Config> => {
    if (!config.collections) {
      config.collections = []
    }

    const options = resolveOptions(pluginOptions)
    // Warnings are deferred to onInit, where payload.logger is available.
    const warnings: string[] = []

    // Always register collections so the database schema stays consistent for
    // migrations, even when the plugin is disabled — they are hidden from the
    // admin UI and stop queueing imports instead.
    const disabled = pluginOptions.disabled === true
    config.collections.push(ImportJobs({ access: options.access, disabled }))
    config.collections.push(ImportRecords({ access: options.access }))

    // Register the import task so queued jobs can run (schema/queue consistency).
    config.jobs = {
      ...config.jobs,
      tasks: [...(config.jobs?.tasks ?? []), importWordpressTask(options)],
    }

    // Apply @payloadcms/plugin-redirects (optional peer) for internal-link
    // redirects. Dynamically imported so hosts that disable redirects (or don't
    // install the plugin) aren't forced to depend on it. Applied before the
    // `disabled` check so the `redirects` collection — and the
    // `payload_locked_documents_rels.redirects_id` column that comes with it —
    // stay in the schema once an import is done and the plugin is switched off.
    if (options.redirects) {
      try {
        const { redirectsPlugin } = await import('@payloadcms/plugin-redirects')
        // The target collection(s) become the `to.reference` relationTo.
        config = redirectsPlugin({
          collections: [options.collections.articles],
        })(config) as Config
      } catch {
        warnings.push(
          '`redirects` is enabled but `@payloadcms/plugin-redirects` is not installed; redirects will be skipped.',
        )
      }
    }

    // Everything below only affects runtime behavior, never the schema, so it
    // is skipped when the plugin is disabled.
    if (!disabled) {
      // Endpoints for programmatic triggering / polling.
      config.endpoints = [
        ...(config.endpoints ?? []),
        startEndpoint(options.access),
        statusEndpoint(options.access),
      ]

      // Auto-run schedule so creating a job runs it without an external worker.
      if (pluginOptions.autoRun !== false) {
        const schedule = typeof pluginOptions.autoRun === 'object' ? pluginOptions.autoRun : {}
        const entry = { cron: schedule.cron ?? '* * * * *', queue: schedule.queue ?? 'default' }
        const jobs = (config.jobs ??= { tasks: [] })
        const existing = jobs.autoRun
        if (existing === undefined) {
          jobs.autoRun = [entry]
        } else if (Array.isArray(existing)) {
          jobs.autoRun = [...existing, entry]
        } else {
          warnings.push('`jobs.autoRun` is a function; skipping the plugin auto-run schedule.')
        }
      }
    }

    if (warnings.length > 0) {
      const incomingOnInit = config.onInit
      config.onInit = async (payload) => {
        if (incomingOnInit) {
          await incomingOnInit(payload)
        }
        for (const warning of warnings) {
          payload.logger.warn(`[${LOG_PREFIX}] ${warning}`)
        }
      }
    }

    return config
  }

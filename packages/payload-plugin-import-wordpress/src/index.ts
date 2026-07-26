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

    // Apply @composius/payload-plugin-redirections (optional peer). Dynamically
    // imported so hosts that disable redirections (or don't install the plugin)
    // aren't forced to depend on it. Applied before the `disabled` check so the
    // collection — and the `payload_locked_documents_rels` column that comes
    // with it — stay in the schema once an import is done and the plugin is
    // switched off.
    if (options.redirections.enabled) {
      // Reuse the collection when the app already registers it (its own
      // `ComposiusPayloadPluginRedirections` listed earlier) instead of adding a
      // second one, which would fail with `DuplicateCollection`.
      // `manage: false` covers the case where the app's plugin runs *after*
      // this one.
      const { manage, slug } = options.redirections
      const alreadyRegistered = config.collections.some(
        (collection) => collection.slug === slug,
      )

      if (alreadyRegistered) {
        if (manage === true) {
          warnings.push(
            `\`redirections.manage\` is \`true\` but a \`${slug}\` collection is already registered; reusing the existing one.`,
          )
        }
      } else if (manage !== false) {
        try {
          const { ComposiusPayloadPluginRedirections } = await import(
            '@composius/payload-plugin-redirections'
          )
          config = ComposiusPayloadPluginRedirections({
            slug,
            ...options.redirections.pluginOptions,
          })(config)
        } catch {
          warnings.push(
            '`redirections` is enabled but `@composius/payload-plugin-redirections` is not installed; redirections will be skipped.',
          )
        }
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

import type { Config } from 'payload'

import type { UmamiRange, UmamiStatId } from './types.js'

import { reportEndpoint } from './endpoints/report.js'
import { en } from './translations/en.js'
import { fr } from './translations/fr.js'
import { DEFAULT_STATS } from './types.js'

export type { UmamiRange, UmamiReport, UmamiStatId } from './types.js'

export type VWPayloadPluginUmamiConfig = {
  /** Umami website ID (UUID) to report on. */
  websiteId: string
  /**
   * Umami Cloud API key (sent as `x-umami-api-key`). Use this OR
   * `username`/`password`. Takes precedence when both are set.
   */
  apiKey?: string
  /** Self-hosted username (used with `password`). */
  username?: string
  /** Self-hosted password (used with `username`). */
  password?: string
  /**
   * API base URL. Defaults to Umami Cloud (`https://api.umami.is`, data paths
   * under `/v1`). For self-hosted, set your instance URL (data paths under
   * `/api`).
   * @default 'https://api.umami.is'
   */
  baseUrl?: string
  /**
   * IANA timezone used to bucket the time-series chart.
   * @default the server timezone
   */
  timezone?: string
  /**
   * Initial time range shown in the dashboard.
   * @default '7d'
   */
  defaultRange?: UmamiRange
  /**
   * Show the in-panel range selector (24h / 7d / 30d / 90d).
   * @default true
   */
  showRangeSelector?: boolean
  /**
   * Which stat cards to show, in order. Available: `visitors`, `views`,
   * `visits`, `bounces`, `duration` (average visit duration), and their
   * `...Prev` variants for the period immediately before the selected range.
   * @default ['visitors', 'views', 'visitorsPrev', 'viewsPrev']
   */
  stats?: UmamiStatId[]
  /** Leaves the config untouched. */
  disabled?: boolean
}

const COMPONENT_PATH = '@vitrailweb/payload-plugin-umami/client'
const COMPONENT_EXPORT = 'UmamiDashboard'
export const WIDGET_SLUG = 'umami'

/**
 * Adds an Umami web-analytics widget (stat cards, top pages, top countries,
 * and a visitors/views time chart) to the Payload admin dashboard, registered
 * through the modular-dashboard API (`admin.dashboard`, experimental in
 * Payload 3.x) so it can be dragged, resized, removed and re-added like the
 * built-in collections widget. Analytics are fetched server-side through a
 * proxy endpoint, so Umami credentials never reach the browser.
 */
export const VWPayloadPluginUmami =
  (pluginOptions: VWPayloadPluginUmamiConfig) =>
  (config: Config): Config => {
    if (pluginOptions.disabled) {
      return config
    }

    const { apiKey, password, username, websiteId } = pluginOptions
    const hasCredentials = Boolean(apiKey) || Boolean(username && password)

    // Credentials usually come from env vars, which may be absent (local dev,
    // CI). Degrade to no widgets instead of crashing the config build.
    if (!websiteId || !hasCredentials) {
      console.warn(
        '[@vitrailweb/payload-plugin-umami] `websiteId` or credentials missing, analytics widgets are disabled.',
      )
      return config
    }

    const defaultRange = pluginOptions.defaultRange ?? '7d'

    config.endpoints = [
      ...(config.endpoints ?? []),
      reportEndpoint(
        {
          apiKey,
          baseUrl: pluginOptions.baseUrl,
          password,
          timezone: pluginOptions.timezone,
          username,
          websiteId,
        },
        defaultRange,
      ),
    ]

    if (!config.admin) config.admin = {}

    // Registered as a modular-dashboard widget so users can drag, resize,
    // remove and re-add it from the dashboard's edit mode, like the built-in
    // collections widget.
    if (!config.admin.dashboard) config.admin.dashboard = { widgets: [] }
    config.admin.dashboard.widgets.push({
      slug: WIDGET_SLUG,
      Component: {
        path: COMPONENT_PATH,
        exportName: COMPONENT_EXPORT,
        clientProps: {
          defaultRange,
          showRangeSelector: pluginOptions.showRangeSelector ?? true,
          stats: pluginOptions.stats ?? DEFAULT_STATS,
        },
      },
      label: { en: en.umami.title, fr: fr.umami.title },
      minWidth: 'medium',
    })

    // Show the widget by default, above the collections widget Payload adds
    // during sanitization. A user-defined layout is left untouched — the
    // widget then only appears in the "add widget" drawer.
    config.admin.dashboard.defaultLayout ??= [
      { widgetSlug: WIDGET_SLUG, width: 'full' },
      { widgetSlug: 'collections', width: 'full' },
    ]

    return config
  }

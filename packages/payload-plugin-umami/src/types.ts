import type { Access } from 'payload'

export type UmamiAccess = {
  /**
   * Who can see the analytics. Evaluated when rendering the dashboard widget
   * (denied users get nothing) and again in the report endpoint.
   * Defaults to any authenticated user.
   */
  read?: Access
}

export type UmamiRange = '24h' | '7d' | '30d' | '90d'

export const UMAMI_RANGES: UmamiRange[] = ['24h', '7d', '30d', '90d']

/** A single `{ x, y }` point as returned by Umami metrics/pageviews. */
export type UmamiPoint = {
  x: string
  y: number
}

/** Response of `GET /websites/:id/stats`. */
export type UmamiStats = {
  pageviews: number
  visitors: number
  visits: number
  bounces: number
  totaltime: number
}

/** Response of `GET /websites/:id/pageviews`. */
export type UmamiSeries = {
  /** Views over time. */
  pageviews: UmamiPoint[]
  /** Visitor sessions over time. */
  sessions: UmamiPoint[]
}

/** The combined payload returned by the `/plugin-umami/report` endpoint. */
export type UmamiReport = {
  range: UmamiRange
  stats: UmamiStats
  /** Same stats over the period immediately before the selected range. */
  prevStats: UmamiStats
  topPages: UmamiPoint[]
  topCountries: UmamiPoint[]
  series: UmamiSeries
}

/**
 * A stat card shown in the dashboard. `duration` is the average visit
 * duration (`totaltime / visits`). The `Prev` variants show the same metric
 * over the period immediately before the selected range.
 */
export type UmamiStatId =
  | 'bounces'
  | 'bouncesPrev'
  | 'duration'
  | 'durationPrev'
  | 'views'
  | 'viewsPrev'
  | 'visitors'
  | 'visitorsPrev'
  | 'visits'
  | 'visitsPrev'

export const DEFAULT_STATS: UmamiStatId[] = ['visitors', 'views', 'visitorsPrev', 'viewsPrev']

/** Props passed from the plugin to the dashboard client component. */
export type UmamiDashboardProps = {
  defaultRange?: UmamiRange
  showRangeSelector?: boolean
  stats?: UmamiStatId[]
}

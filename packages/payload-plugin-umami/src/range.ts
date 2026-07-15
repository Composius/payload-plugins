import type { UmamiRange } from './types.js'

import { UMAMI_RANGES } from './types.js'

const DAY = 24 * 60 * 60 * 1000

const RANGE_MS: Record<UmamiRange, number> = {
  '24h': DAY,
  '7d': 7 * DAY,
  '30d': 30 * DAY,
  '90d': 90 * DAY,
}

export type UmamiWindow = {
  startAt: number
  endAt: number
  unit: 'hour' | 'day'
}

export const isUmamiRange = (value: unknown): value is UmamiRange =>
  typeof value === 'string' && (UMAMI_RANGES as string[]).includes(value)

/**
 * Turns a range token into the absolute `startAt`/`endAt` (ms unix) window and
 * the time-series bucket `unit` Umami expects. `24h` buckets by hour, the
 * longer ranges by day.
 */
export const rangeToWindow = (range: UmamiRange, now: number = Date.now()): UmamiWindow => ({
  startAt: now - RANGE_MS[range],
  endAt: now,
  unit: range === '24h' ? 'hour' : 'day',
})

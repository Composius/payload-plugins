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

/**
 * Floors a timestamp to the start of its bucket in local time. Local rather
 * than UTC so the buckets line up with the ones Umami returns (it buckets in
 * the timezone we pass) and with how the chart formats its ticks.
 */
export const floorToBucket = (t: number, unit: UmamiWindow['unit']): number => {
  const date = new Date(t)
  if (unit === 'hour') {
    date.setMinutes(0, 0, 0)
  } else {
    date.setHours(0, 0, 0, 0)
  }
  return date.getTime()
}

/**
 * Every bucket start in the window, so the chart can render empty periods as
 * zeroes instead of dropping them — Umami omits buckets with no traffic.
 * Steps with `Date` setters rather than fixed millisecond arithmetic so a DST
 * change doesn't shift every following bucket off the hour/midnight.
 */
export const bucketGrid = (range: UmamiRange, now: number = Date.now()): number[] => {
  const { endAt, startAt, unit } = rangeToWindow(range, now)
  const last = floorToBucket(endAt, unit)
  const cursor = new Date(floorToBucket(startAt, unit))
  const buckets: number[] = []

  while (cursor.getTime() <= last) {
    buckets.push(cursor.getTime())
    if (unit === 'hour') {
      cursor.setHours(cursor.getHours() + 1)
    } else {
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return buckets
}

import { describe, expect, test } from 'vitest'

import { bucketGrid, floorToBucket, isUmamiRange, rangeToWindow } from '../src/range.js'

describe('rangeToWindow', () => {
  const now = 1_700_000_000_000

  test('24h spans one day and buckets by hour', () => {
    const { endAt, startAt, unit } = rangeToWindow('24h', now)
    expect(endAt).toBe(now)
    expect(startAt).toBe(now - 24 * 60 * 60 * 1000)
    expect(unit).toBe('hour')
  })

  test('7d/30d/90d bucket by day with the right span', () => {
    const day = 24 * 60 * 60 * 1000
    expect(rangeToWindow('7d', now)).toMatchObject({ startAt: now - 7 * day, unit: 'day' })
    expect(rangeToWindow('30d', now)).toMatchObject({ startAt: now - 30 * day, unit: 'day' })
    expect(rangeToWindow('90d', now)).toMatchObject({ startAt: now - 90 * day, unit: 'day' })
  })
})

describe('floorToBucket', () => {
  const now = new Date(2023, 10, 14, 13, 47, 12, 500).getTime()

  test('hour buckets drop minutes and below', () => {
    expect(floorToBucket(now, 'hour')).toBe(new Date(2023, 10, 14, 13).getTime())
  })

  test('day buckets drop to local midnight', () => {
    expect(floorToBucket(now, 'day')).toBe(new Date(2023, 10, 14).getTime())
  })
})

describe('bucketGrid', () => {
  const now = new Date(2023, 10, 14, 13, 47).getTime()

  test('24h yields every hour in the window', () => {
    const grid = bucketGrid('24h', now)
    expect(grid).toHaveLength(25)
    expect(grid[0]).toBe(new Date(2023, 10, 13, 13).getTime())
    expect(grid.at(-1)).toBe(new Date(2023, 10, 14, 13).getTime())
  })

  test('7d yields every day at local midnight', () => {
    const grid = bucketGrid('7d', now)
    expect(grid).toHaveLength(8)
    expect(grid[0]).toBe(new Date(2023, 10, 7).getTime())
    expect(grid.at(-1)).toBe(new Date(2023, 10, 14).getTime())
    for (const t of grid) expect(new Date(t).getHours()).toBe(0)
  })

  test('longer ranges stay aligned to midnight across a DST change', () => {
    const grid = bucketGrid('90d', now)
    expect(grid).toHaveLength(91)
    for (const t of grid) expect(new Date(t).getHours()).toBe(0)
  })
})

describe('isUmamiRange', () => {
  test('accepts valid tokens', () => {
    expect(isUmamiRange('7d')).toBe(true)
    expect(isUmamiRange('24h')).toBe(true)
  })

  test('rejects anything else', () => {
    expect(isUmamiRange('1y')).toBe(false)
    expect(isUmamiRange(undefined)).toBe(false)
    expect(isUmamiRange(7)).toBe(false)
  })
})

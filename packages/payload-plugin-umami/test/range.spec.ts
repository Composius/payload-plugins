import { describe, expect, test } from 'vitest'

import { isUmamiRange, rangeToWindow } from '../src/range.js'

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

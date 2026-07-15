'use client'

import React from 'react'

export type StatCardProps = {
  label: string
  value: number
  /** How the value is rendered: a count or a duration in seconds. @default 'number' */
  format?: 'duration' | 'number'
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const full = new Intl.NumberFormat()

/** Formats seconds as `3m 24s` (or `1h 02m` past an hour). */
const formatDuration = (seconds: number): string => {
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`
  }
  return `${minutes}m ${String(secs).padStart(2, '0')}s`
}

/** A single headline figure (visitors, views, average visit duration, ...). */
export const StatCard = ({ format = 'number', label, value }: StatCardProps) => (
  <div className="umami-card umami-stat">
    <span className="umami-stat__label">{label}</span>
    <span className="umami-stat__value" title={format === 'number' ? full.format(value) : undefined}>
      {format === 'duration' ? formatDuration(value) : compact.format(value)}
    </span>
  </div>
)

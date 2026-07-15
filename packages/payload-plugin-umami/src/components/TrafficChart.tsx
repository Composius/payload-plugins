'use client'

import React, { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { UmamiRange, UmamiSeries } from '../types.js'

export type TrafficChartProps = {
  series: UmamiSeries
  range: UmamiRange
  viewsLabel: string
  visitorsLabel: string
}

type Row = { t: number; views: number; visitors: number }

const mergeSeries = (series: UmamiSeries): Row[] => {
  const byTime = new Map<number, Row>()
  const ensure = (x: string): Row => {
    const t = new Date(x).getTime()
    let row = byTime.get(t)
    if (!row) {
      row = { t, views: 0, visitors: 0 }
      byTime.set(t, row)
    }
    return row
  }
  for (const point of series.pageviews) ensure(point.x).views = point.y
  for (const point of series.sessions) ensure(point.x).visitors = point.y
  return [...byTime.values()].sort((a, b) => a.t - b.t)
}

/**
 * Visitors + views over time. Single y-axis, two categorical series (views =
 * blue slot 1, visitors = aqua slot 2). Series colors are theme-aware CSS vars
 * defined by the dashboard; chrome uses Payload's admin theme variables.
 */
export const TrafficChart = ({ range, series, viewsLabel, visitorsLabel }: TrafficChartProps) => {
  const data = useMemo(() => mergeSeries(series), [series])

  const formatTick = (t: number) => {
    const date = new Date(t)
    return range === '24h'
      ? date.toLocaleTimeString(undefined, { hour: '2-digit' })
      : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  }

  return (
    <div className="umami-card umami-chart">
      <ResponsiveContainer height={280} width="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--umami-grid)" vertical={false} />
          <XAxis
            dataKey="t"
            stroke="var(--umami-axis)"
            tick={{ fill: 'var(--umami-muted)', fontSize: 12 }}
            tickFormatter={formatTick}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            stroke="var(--umami-axis)"
            tick={{ fill: 'var(--umami-muted)', fontSize: 12 }}
            tickLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--theme-elevation-50)',
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: 4,
              color: 'var(--theme-text)',
            }}
            labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
          />
          <Legend />
          <Line
            dataKey="views"
            dot={false}
            name={viewsLabel}
            stroke="var(--umami-series-views)"
            strokeWidth={2}
            type="monotone"
          />
          <Line
            dataKey="visitors"
            dot={false}
            name={visitorsLabel}
            stroke="var(--umami-series-visitors)"
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

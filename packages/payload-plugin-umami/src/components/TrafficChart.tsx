'use client'

import React, { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { UmamiRange, UmamiSeries } from '../types.js'

export type TrafficChartProps = {
  series: UmamiSeries
  range: UmamiRange
  /** Accessible label for the stat dropdown. */
  metricLabel: string
  viewsLabel: string
  visitorsLabel: string
}

/**
 * The stats Umami exposes as a time series. Visits over time is not
 * available: the `/pageviews` endpoint only returns pageviews and sessions
 * buckets (Umami's own dashboard chart has the same two).
 */
type ChartMetric = 'views' | 'visitors'

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
 * Traffic over time as a bar chart showing one stat at a time — views (the
 * default) or visitors, picked from an in-card dropdown. Single series, so no
 * legend; the color follows the stat (views = blue, visitors = aqua, the
 * series CSS vars defined by the dashboard). Chrome uses Payload's admin
 * theme variables.
 */
export const TrafficChart = ({
  metricLabel,
  range,
  series,
  viewsLabel,
  visitorsLabel,
}: TrafficChartProps) => {
  const [metric, setMetric] = useState<ChartMetric>('views')
  const data = useMemo(() => mergeSeries(series), [series])

  const metricLabels: Record<ChartMetric, string> = {
    views: viewsLabel,
    visitors: visitorsLabel,
  }

  const formatTick = (t: number) => {
    const date = new Date(t)
    return range === '24h'
      ? date.toLocaleTimeString(undefined, { hour: '2-digit' })
      : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  }

  return (
    <div className="umami-card umami-chart">
      <div className="umami-chart__header">
        <select
          aria-label={metricLabel}
          className="umami-dashboard__select"
          onChange={(event) => setMetric(event.target.value as ChartMetric)}
          value={metric}
        >
          {(['views', 'visitors'] as const).map((value) => (
            <option key={value} value={value}>
              {metricLabels[value]}
            </option>
          ))}
        </select>
      </div>
      <ResponsiveContainer height={280} width="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
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
            cursor={{ fill: 'var(--umami-grid)', opacity: 0.5 }}
            labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
          />
          <Bar
            dataKey={metric}
            fill={metric === 'views' ? 'var(--umami-series-views)' : 'var(--umami-series-visitors)'}
            maxBarSize={40}
            name={metricLabels[metric]}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

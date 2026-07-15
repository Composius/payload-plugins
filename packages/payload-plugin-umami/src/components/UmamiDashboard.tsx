'use client'

import { useConfig, useTranslation } from '@payloadcms/ui'
import React, { useEffect, useMemo, useState } from 'react'

import type {
  UmamiDashboardProps,
  UmamiRange,
  UmamiReport,
  UmamiStatId,
  UmamiStats,
} from '../types.js'

import { en } from '../translations/en.js'
import { fr } from '../translations/fr.js'
import { DEFAULT_STATS, UMAMI_RANGES } from '../types.js'
import { dashboardStyles } from './dashboardStyles.js'
import { StatCard } from './StatCard.js'
import { TopList } from './TopList.js'
import { TrafficChart } from './TrafficChart.js'

/** Average visit duration in seconds. */
const avgDuration = (stats: UmamiStats): number =>
  stats.visits > 0 ? stats.totaltime / stats.visits : 0

type StatDef = {
  format?: 'duration' | 'number'
  /** Which period's stats the card reads from. */
  period: 'current' | 'prev'
  value: (stats: UmamiStats) => number
}

// Labels come from translations (t.umami.stats[id]).
const STAT_DEFS: Record<UmamiStatId, StatDef> = {
  visitors: { period: 'current', value: (s) => s.visitors },
  visitorsPrev: { period: 'prev', value: (s) => s.visitors },
  views: { period: 'current', value: (s) => s.pageviews },
  viewsPrev: { period: 'prev', value: (s) => s.pageviews },
  visits: { period: 'current', value: (s) => s.visits },
  visitsPrev: { period: 'prev', value: (s) => s.visits },
  bounces: { period: 'current', value: (s) => s.bounces },
  bouncesPrev: { period: 'prev', value: (s) => s.bounces },
  duration: { format: 'duration', period: 'current', value: avgDuration },
  durationPrev: { format: 'duration', period: 'prev', value: avgDuration },
}

/**
 * Dashboard section that presents five Umami widgets — visits, views, top 5
 * pages, top 5 countries, and a visitors/views time chart — over a shared,
 * user-selectable time range. All widgets are driven by a single fetch to the
 * `/plugin-umami/report` proxy endpoint, so Umami credentials stay server-side.
 */
export const UmamiDashboard = ({
  defaultRange = '7d',
  showRangeSelector = true,
  stats = DEFAULT_STATS,
}: UmamiDashboardProps) => {
  const { config } = useConfig()
  const { i18n } = useTranslation()
  const t = (i18n.language === 'fr' ? fr : en).umami

  // Umami reports countries as ISO 3166-1 alpha-2 codes; Intl.DisplayNames
  // localizes them in the admin language with no bundled data.
  const countryName = useMemo(() => {
    const regionNames = new Intl.DisplayNames([i18n.language, 'en'], { type: 'region' })
    return (code: string): string => {
      if (!code) return code
      try {
        return regionNames.of(code.toUpperCase()) ?? code
      } catch {
        // Invalid code (e.g. Umami's "Unknown" bucket) — show it as-is.
        return code
      }
    }
  }, [i18n.language])
  const [range, setRange] = useState<UmamiRange>(defaultRange)
  const [report, setReport] = useState<UmamiReport>()
  const [status, setStatus] = useState<'error' | 'loading' | 'ready'>('loading')

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      setStatus('loading')
      try {
        const response = await fetch(
          `${config.serverURL}${config.routes.api}/plugin-umami/report?range=${range}`,
          { credentials: 'include', signal: controller.signal },
        )
        if (!response.ok) {
          setStatus('error')
          return
        }
        setReport((await response.json()) as UmamiReport)
        setStatus('ready')
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to load Umami analytics', error)
          setStatus('error')
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [config.serverURL, config.routes.api, range])

  return (
    <div className="umami-dashboard">
      <style>{dashboardStyles}</style>
      <div className="umami-dashboard__header">
        <h2 className="umami-dashboard__title">{t.title}</h2>
        {showRangeSelector && (
          <select
            aria-label={t.timeRange}
            className="umami-dashboard__select"
            onChange={(event) => setRange(event.target.value as UmamiRange)}
            value={range}
          >
            {UMAMI_RANGES.map((value) => (
              <option key={value} value={value}>
                {t.ranges[value]}
              </option>
            ))}
          </select>
        )}
      </div>

      {status === 'error' ? (
        <p className="umami-message">{t.messages.error}</p>
      ) : status === 'loading' && !report ? (
        <p className="umami-message">{t.messages.loading}</p>
      ) : report ? (
        <div className="umami-grid" style={{ opacity: status === 'loading' ? 0.6 : 1 }}>
          {stats
            .filter((id) => id in STAT_DEFS)
            .map((id) => {
              const def = STAT_DEFS[id]
              return (
                <StatCard
                  format={def.format}
                  key={id}
                  label={t.stats[id]}
                  value={def.value(def.period === 'prev' ? report.prevStats : report.stats)}
                />
              )
            })}
          <TrafficChart
            metricLabel={t.chartMetric}
            range={report.range}
            series={report.series}
            viewsLabel={t.stats.views}
            visitorsLabel={t.stats.visitors}
          />
          <TopList emptyLabel={t.messages.noPages} items={report.topPages} title={t.topPages} />
          <TopList
            emptyLabel={t.messages.noCountries}
            items={report.topCountries.map((point) => ({ ...point, x: countryName(point.x) }))}
            title={t.topCountries}
          />
        </div>
      ) : null}
    </div>
  )
}

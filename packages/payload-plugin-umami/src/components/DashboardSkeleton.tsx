'use client'

import React from 'react'

export type DashboardSkeletonProps = {
  /** How many stat cards the loaded dashboard will show. */
  statCount: number
  /** Announced to screen readers while the report is in flight. */
  label: string
}

/**
 * Placeholder shown while the report loads. It mirrors the real grid — same
 * card classes, same stat count, same 280px chart body — so the section keeps
 * its height when the data arrives instead of the panel jumping down.
 *
 * The bars deliberately reuse the text classes they stand in for
 * (`umami-stat__value`, `umami-top__name`, ...) and hold a non-breaking space:
 * they inherit the real font-size and line-height, so their heights match
 * without hard-coding pixel values that would drift as the styles change.
 */
export const DashboardSkeleton = ({ label, statCount }: DashboardSkeletonProps) => (
  <div aria-busy="true" aria-label={label} className="umami-grid" role="status">
    {Array.from({ length: statCount }, (_, index) => (
      <div className="umami-card umami-stat" key={index}>
        <span className="umami-stat__label umami-skeleton umami-skeleton--label">&nbsp;</span>
        <span className="umami-stat__value umami-skeleton umami-skeleton--value">&nbsp;</span>
      </div>
    ))}
    <div className="umami-card umami-chart">
      <div className="umami-chart__header">
        <span className="umami-dashboard__select umami-skeleton umami-skeleton--select">&nbsp;</span>
      </div>
      <div className="umami-skeleton umami-skeleton--chart" />
    </div>
    {[0, 1].map((card) => (
      <div className="umami-card umami-top" key={card}>
        <span className="umami-card__title umami-skeleton umami-skeleton--title">&nbsp;</span>
        <ol className="umami-top__list">
          {Array.from({ length: 5 }, (_, row) => (
            <li className="umami-top__row" key={row}>
              <span className="umami-top__name umami-skeleton">&nbsp;</span>
            </li>
          ))}
        </ol>
      </div>
    ))}
  </div>
)

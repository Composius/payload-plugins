'use client'

import React from 'react'

import type { UmamiPoint } from '../types.js'

export type TopListProps = {
  title: string
  items: UmamiPoint[]
  /** Message shown when there is no data in the range. */
  emptyLabel: string
}

const full = new Intl.NumberFormat()

/** A ranked "top 5" list (used for Top Pages and Top Countries). */
export const TopList = ({ emptyLabel, items, title }: TopListProps) => (
  <div className="umami-card umami-top">
    <span className="umami-card__title">{title}</span>
    {items.length === 0 ? (
      <p className="umami-empty">{emptyLabel}</p>
    ) : (
      <ol className="umami-top__list">
        {items.map((item) => (
          <li className="umami-top__row" key={item.x}>
            <span className="umami-top__name" title={item.x}>
              {item.x || '—'}
            </span>
            <span className="umami-top__value">{full.format(item.y)}</span>
          </li>
        ))}
      </ol>
    )}
  </div>
)

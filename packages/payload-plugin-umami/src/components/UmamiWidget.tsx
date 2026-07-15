import type { Access, PayloadRequest } from 'payload'

// Imported through the package's own /client subpath (not a relative path) so
// the client bundle — and its 'use client' directive — stays external to this
// server-component bundle.
import { UmamiDashboard } from '@vitrailweb/payload-plugin-umami/client'
import React from 'react'

import type { UmamiDashboardProps } from '../types.js'

export type UmamiWidgetProps = UmamiDashboardProps & {
  /** `access.read` resolved by the plugin, evaluated per request. */
  access: Access
  /** Injected by Payload when rendering dashboard widgets. */
  req: PayloadRequest
}

/**
 * Server-component gate around the dashboard: evaluates the plugin's `read`
 * access with the current request and renders nothing when denied, so the
 * widget stays empty for unauthorized users even if it is part of their saved
 * dashboard layout. The report endpoint enforces the same access server-side.
 */
export const UmamiWidget = async ({
  access,
  defaultRange,
  req,
  showRangeSelector,
  stats,
}: UmamiWidgetProps) => {
  const allowed = await access({ req })

  if (!allowed) {
    return null
  }

  return (
    <UmamiDashboard
      defaultRange={defaultRange}
      showRangeSelector={showRangeSelector}
      stats={stats}
    />
  )
}

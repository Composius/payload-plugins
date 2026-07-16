import type { ServerProps } from 'payload'

import { Link } from '@payloadcms/ui'
import React from 'react'

import type { LocalizedText } from '../localized.js'

import { resolveHomeLabel } from '../label.js'

export type HomeNavLinkProps = ServerProps & {
  /** Destination from the plugin options. Default: the admin dashboard. */
  href?: string
  /** Label override from the plugin options, plain or per-language. */
  label?: LocalizedText
}

/**
 * Server component for the `admin.components.beforeNavLinks` slot: a "Home"
 * link rendered above the collection/global links of the nav sidebar. It
 * reuses the nav's own `nav__link` classes so it looks like the built-in
 * links, and @payloadcms/ui's Link so navigation stays client-side.
 */
export const HomeNavLink = ({ href, i18n, label, payload }: HomeNavLinkProps) => {
  const text = resolveHomeLabel(label, i18n?.language ?? 'en')
  const url = href ?? payload?.config?.routes?.admin ?? '/admin'

  return (
    <Link className="nav__link" href={url} id="nav-home" prefetch={false}>
      <span className="nav__link-label">{text}</span>
    </Link>
  )
}

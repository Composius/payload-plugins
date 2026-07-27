import type { ServerProps } from 'payload'

import React from 'react'

import type { LocalizedText } from '../localized.js'

import { resolveVersionLabel } from '../label.js'
import { resolveAppVersion } from '../version.js'

/**
 * `.nav__controls` (settings menu + logout) is pushed to the bottom of the
 * sidebar with `margin-top: auto`. This block sits just above it and takes
 * that job over, so the two stay together at the bottom instead of sharing
 * the free space between them. The rules are unlayered, so they win over
 * Payload's `@layer payload-default` styles.
 */
const versionStyles = `
.nav__wrap:has(.home-nav-version) .nav__controls {
  margin-top: 0;
}
.home-nav-version {
  margin-top: auto;
  padding-top: 20px;
  font-size: 0.8125rem;
  line-height: 1.2;
  color: var(--theme-elevation-500);
}
`

export type HomeNavVersionProps = ServerProps & {
  /** Label shown in front of the number. Default: "Version" / "Version". */
  versionLabel?: LocalizedText
  /** Version override from the plugin options. Default: the app's own. */
  versionNumber?: string
}

/**
 * Server component for the `admin.components.afterNavLinks` slot: the app's
 * version, rendered at the bottom of the nav sidebar just above the logout
 * button. Renders nothing when no version can be resolved.
 */
export const HomeNavVersion = ({
  i18n,
  payload,
  versionLabel,
  versionNumber,
}: HomeNavVersionProps) => {
  const version = versionNumber ?? resolveAppVersion(payload?.logger)

  if (!version) {
    return null
  }

  const label = resolveVersionLabel(versionLabel, i18n?.language ?? 'en')

  return (
    <div className="home-nav-version">
      <style>{versionStyles}</style>
      {label} {version}
    </div>
  )
}

import type { PayloadComponent, ServerProps } from 'payload'

import { PayloadIcon } from '@payloadcms/ui'
import { RenderServerComponent } from '@payloadcms/ui/elements/RenderServerComponent'
import React from 'react'

import type { LocalizedText } from '../localized.js'

import { resolveHomeLabel } from '../label.js'

/**
 * The step-nav fixes its home link to 18px x 18px (icon-only), which would
 * clip the label — un-fix it when this component is inside. These rules are
 * unlayered, so they win over Payload's `@layer payload-default` styles.
 * The icon gets its own 18px box instead (PayloadIcon is width/height 100%).
 * The step-nav also sets `* { display: block }`, which beats the browser's
 * `style { display: none }` and would render this CSS as text — hide it back.
 */
const iconStyles = `
.home-nav-icon > style {
  display: none;
}
.step-nav__home:has(.home-nav-icon) {
  width: auto;
  height: auto;
}
.home-nav-icon {
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1;
}
.home-nav-icon__icon {
  display: block;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.home-nav-icon__label {
  font-weight: 600;
}
`

export type HomeNavIconProps = ServerProps & {
  /**
   * The `admin.components.graphics.Icon` the project had configured before
   * the plugin took the slot over — re-rendered next to the label so custom
   * icons keep working. Default: Payload's own icon.
   */
  icon?: PayloadComponent
  /** Label override from the plugin options, plain or per-language. */
  label?: LocalizedText
}

/**
 * Server component for the `admin.components.graphics.Icon` slot: the
 * project's icon (custom `graphics.Icon` if one was configured, Payload's
 * icon otherwise) with a translated "Home" label next to it. The step-nav
 * already wraps this slot in a link to the admin dashboard, so the label
 * needs no link of its own.
 */
export const HomeNavIcon = ({ i18n, icon, label, payload, ...serverProps }: HomeNavIconProps) => {
  const text = resolveHomeLabel(label, i18n?.language ?? 'en')

  const Icon = RenderServerComponent({
    Component: icon,
    Fallback: PayloadIcon,
    importMap: payload?.importMap,
    serverProps: { ...serverProps, i18n, payload },
  })

  return (
    <span className="home-nav-icon">
      <style>{iconStyles}</style>
      <span className="home-nav-icon__icon">{Icon}</span>
      <span className="home-nav-icon__label">{text}</span>
    </span>
  )
}

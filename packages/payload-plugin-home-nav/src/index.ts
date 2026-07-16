import type { Config } from 'payload'

import type { LocalizedText } from './localized.js'

export { resolveLocalizedText } from './localized.js'
export type { LocalizedText } from './localized.js'

export type VWPayloadPluginHomeNavConfig = {
  /**
   * Where "Home" links to.
   * @default the admin dashboard (`routes.admin`)
   */
  href?: string
  /**
   * The label, plain or per-language. Default: "Home" / "Accueil" from the
   * plugin's bundled translations, resolved against the admin language.
   */
  label?: LocalizedText
  /**
   * Show the label next to the icon in the app header (the
   * `admin.components.graphics.Icon` slot). A custom icon configured before
   * the plugin runs is kept and rendered next to the label.
   * @default true
   */
  iconLabel?: boolean
  /**
   * Add a "Home" link at the top of the nav sidebar (prepended to
   * `admin.components.beforeNavLinks`, above the collection links).
   * @default true
   */
  navLink?: boolean
  /** Leaves the config untouched. */
  disabled?: boolean
}

const COMPONENT_PATH = '@vitrailweb/payload-plugin-home-nav/rsc'

/**
 * Makes the admin's way home obvious: a translated "Home" label next to the
 * icon in the app header (which already links to the dashboard), and a
 * matching "Home" link at the top of the collapsible nav sidebar. Both are
 * server components resolved against the admin language.
 */
export const VWPayloadPluginHomeNav =
  (pluginOptions: VWPayloadPluginHomeNavConfig = {}) =>
  (config: Config): Config => {
    if (pluginOptions.disabled) {
      return config
    }

    const { href, label } = pluginOptions

    if (!config.admin) config.admin = {}
    if (!config.admin.components) config.admin.components = {}

    if (pluginOptions.iconLabel !== false) {
      if (!config.admin.components.graphics) config.admin.components.graphics = {}

      // The slot is taken over, but a custom icon the project configured is
      // handed to the component and rendered next to the label.
      const existingIcon = config.admin.components.graphics.Icon

      if (existingIcon) {
        // `generate:importmap` only scans the known component slots (plus
        // `admin.dependencies`) — the previous icon now lives in serverProps,
        // invisible to the scanner, so register it as an explicit dependency.
        // The key must match the runtime lookup: `path#exportName`, with
        // `default` when no export name is given.
        const pathAndExport =
          typeof existingIcon === 'string' ? existingIcon : existingIcon.path
        let [path, exportName] = pathAndExport.includes('#')
          ? pathAndExport.split('#', 2)
          : [pathAndExport, 'default']
        if (typeof existingIcon === 'object' && existingIcon.exportName) {
          exportName = existingIcon.exportName
        }

        config.admin.dependencies = {
          ...config.admin.dependencies,
          'home-nav-icon': { type: 'component', path: `${path}#${exportName}` },
        }
      }

      config.admin.components.graphics.Icon = {
        path: COMPONENT_PATH,
        exportName: 'HomeNavIcon',
        // Server component — serverProps never reach the client, so they can
        // safely carry the existing icon's component config.
        serverProps: {
          icon: existingIcon,
          label,
        },
      }
    }

    if (pluginOptions.navLink !== false) {
      // Prepended so "Home" stays on top even when other plugins add links.
      config.admin.components.beforeNavLinks = [
        {
          path: COMPONENT_PATH,
          exportName: 'HomeNavLink',
          serverProps: {
            href,
            label,
          },
        },
        ...(config.admin.components.beforeNavLinks ?? []),
      ]
    }

    return config
  }

import type { Access, Config } from 'payload'

import type { CustomPanelAccess, CustomPanelRow, LocalizedText } from './types.js'

export { resolveLocalizedText } from './localized.js'
export type { CustomPanelAccess, CustomPanelLink, CustomPanelRow, LocalizedText } from './types.js'

/** Default `read` access: any authenticated user. */
export const authenticated: Access = ({ req: { user } }) => Boolean(user)

export type VWPayloadPluginCustomPanelConfig = {
  /**
   * Access control for the panel, per operation. Only `read` exists.
   * Default: `read` requires an authenticated user.
   */
  access?: CustomPanelAccess
  /** Site title, shown as the panel heading. */
  title?: LocalizedText
  /**
   * Rows rendered under the title, in order. Each row shows its message next
   * to its link buttons.
   */
  rows?: CustomPanelRow[]
  /** Leaves the config untouched. */
  disabled?: boolean
}

const COMPONENT_PATH = '@vitrailweb/payload-plugin-custom-panel/rsc'
const COMPONENT_EXPORT = 'CustomPanel'

/**
 * Adds a panel above the Payload admin dashboard (`admin.components.beforeDashboard`)
 * showing the site title, a welcome/instructions message and link buttons —
 * all from plugin options. Rendered as a server component gated by
 * `access.read`, so denied users get nothing.
 */
export const VWPayloadPluginCustomPanel =
  (pluginOptions: VWPayloadPluginCustomPanelConfig = {}) =>
  (config: Config): Config => {
    if (pluginOptions.disabled) {
      return config
    }

    const readAccess = pluginOptions.access?.read ?? authenticated

    if (!config.admin) config.admin = {}
    if (!config.admin.components) config.admin.components = {}

    config.admin.components.beforeDashboard = [
      ...(config.admin.components.beforeDashboard ?? []),
      {
        path: COMPONENT_PATH,
        exportName: COMPONENT_EXPORT,
        // A server component renders the panel — everything (including the
        // access function) stays on the server, nothing is serialized to the
        // client.
        serverProps: {
          access: readAccess,
          rows: pluginOptions.rows ?? [],
          title: pluginOptions.title,
        },
      },
    ]

    return config
  }

import type { Config } from 'payload'

import type { MenusAccess } from './collections/Menus.js'
import { Menus } from './collections/Menus.js'
import { anyone, authenticated } from './defaults.js'

export type { MenusAccess }

export type VWPayloadPluginMenusConfig = {
  /**
   * Access control for the menus collection, per operation.
   * Defaults: `read` allows anyone, `create`/`update`/`delete` require an
   * authenticated user.
   */
  access?: MenusAccess
  disabled?: boolean
}

export const VWPayloadPluginMenus =
  (pluginOptions: VWPayloadPluginMenusConfig = {}) =>
  (config: Config): Config => {
    if (!config.collections) {
      config.collections = []
    }

    const access = {
      create: pluginOptions.access?.create ?? authenticated,
      delete: pluginOptions.access?.delete ?? authenticated,
      read: pluginOptions.access?.read ?? anyone,
      update: pluginOptions.access?.update ?? authenticated,
    }

    config.collections.push(Menus({ access }))

    /**
     * If the plugin is disabled, we still want to keep added collections/fields so the database schema is consistent which is important for migrations.
     */
    if (pluginOptions.disabled) {
      return config
    }

    return config
  }

import type { CollectionSlug, Config } from 'payload'

import type { MenusAccess } from './collections/Menus.js'
import { Menus } from './collections/Menus.js'
import { anyone, authenticated } from './defaults.js'

export type { MenusAccess }

export type ComposiusPayloadPluginMenusConfig = {
  /**
   * Access control for the menus collection, per operation.
   * Defaults: `read` allows anyone, `create`/`update`/`delete` require an
   * authenticated user.
   */
  access?: MenusAccess
  /**
   * Collections that can be targeted by internal links in a menu.
   * When empty, only external links are available.
   */
  collections?: CollectionSlug[]
  disabled?: boolean
}

export const ComposiusPayloadPluginMenus =
  (pluginOptions: ComposiusPayloadPluginMenusConfig = {}) =>
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

    config.collections.push(Menus({ access, collections: pluginOptions.collections ?? [] }))

    /**
     * If the plugin is disabled, we still want to keep added collections/fields so the database schema is consistent which is important for migrations.
     */
    if (pluginOptions.disabled) {
      return config
    }

    return config
  }

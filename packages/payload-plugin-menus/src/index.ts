import type { CollectionAdminOptions, CollectionSlug, Config } from 'payload'
import type {
  RevalidateEvent,
  RevalidateOptions,
  RevalidateProfile,
} from '@composius/payload-plugin-shared-components'

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
  /**
   * Hides the menus collection from the admin nav and routes (default:
   * `false`). Accepts a boolean or a `({ user }) => boolean` function, so it can
   * be hidden per user. The collection stays registered, leaving the database
   * schema and the REST/GraphQL API untouched.
   */
  hidden?: CollectionAdminOptions['hidden']
  /**
   * Invalidates the Next.js cache tags of the menus collection whenever a menu
   * is saved or deleted, so a `'use cache'` front end picks the change up. The
   * tags to claim with `cacheTag` are exported from
   * `@composius/payload-plugin-menus/tags`.
   *
   * Enabled by default, and a no-op wherever Next.js is absent (a migration, a
   * seeding script, a test run). Pass an object to tune the cache profile or
   * add tags, or `false` to remove the hooks entirely.
   */
  revalidate?: false | RevalidateOptions
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

    // A disabled plugin keeps its collection for schema consistency, but must
    // not act on it: revalidating from a plugin that is meant to be off would
    // be a side effect nobody asked for.
    const revalidate =
      pluginOptions.disabled || pluginOptions.revalidate === false
        ? false
        : (pluginOptions.revalidate ?? {})

    config.collections.push(
      Menus({
        access,
        collections: pluginOptions.collections ?? [],
        hidden: pluginOptions.hidden ?? false,
        revalidate,
      }),
    )

    /**
     * If the plugin is disabled, we still want to keep added collections/fields so the database schema is consistent which is important for migrations.
     */
    if (pluginOptions.disabled) {
      return config
    }

    return config
  }

export type { RevalidateEvent, RevalidateOptions, RevalidateProfile }
export { menuIdTag, menuTag, MENUS_TAG } from './tags.js'

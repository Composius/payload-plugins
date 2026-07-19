import type { Config } from 'payload'

import {
  hasRole,
  hasRoleFieldLevel,
  hasRoleOrOwner,
  isAdmin,
  isAdminOrHasRole,
  isAuthenticatedOrPublished,
  setAdminRole,
} from './access.js'
import { withUsersAuth } from './collections/Users.js'
import { label } from './translations/index.js'
import type { Role, UsersAccess, ComposiusPayloadPluginAuthConfig } from './types.js'

export {
  hasRole,
  hasRoleFieldLevel,
  hasRoleOrOwner,
  isAdmin,
  isAdminOrHasRole,
  isAuthenticatedOrPublished,
}
export type { Role, UsersAccess, ComposiusPayloadPluginAuthConfig }

const defaultRoles: Role[] = [
  { label: label((t) => t.roles.admin), value: 'admin' },
  { label: label((t) => t.roles.editor), value: 'editor' },
  { label: label((t) => t.roles.viewer), value: 'viewer' },
]

export const ComposiusPayloadPluginAuth =
  (pluginOptions: ComposiusPayloadPluginAuthConfig = {}) =>
  (config: Config): Config => {
    const slug = pluginOptions.slug ?? 'users'
    const roles = pluginOptions.roles ?? defaultRoles
    const adminRole = pluginOptions.adminRole ?? 'admin'
    const defaultRole = pluginOptions.defaultRole ?? 'viewer'

    // A wrong role value here would lock everyone out of the users collection
    // (or hand new users an invalid role), so fail at config build time.
    const roleValues = roles.map((role) => role.value)
    if (!roleValues.includes(adminRole)) {
      throw new Error(
        `ComposiusPayloadPluginAuth: adminRole "${adminRole}" is not one of the configured roles (${roleValues.join(', ')})`,
      )
    }
    if (!roleValues.includes(defaultRole)) {
      throw new Error(
        `ComposiusPayloadPluginAuth: defaultRole "${defaultRole}" is not one of the configured roles (${roleValues.join(', ')})`,
      )
    }

    // Keep the exported isAdmin/isAdminOrHasRole helpers in sync with the option.
    setAdminRole(adminRole)

    const adminOrSelf = hasRoleOrOwner([adminRole], 'id')

    const access = {
      create: pluginOptions.access?.create ?? isAdmin,
      delete: pluginOptions.access?.delete ?? isAdmin,
      read: pluginOptions.access?.read ?? adminOrSelf,
      update: pluginOptions.access?.update ?? adminOrSelf,
    }

    if (!config.collections) {
      config.collections = []
    }

    const existingIndex = config.collections.findIndex((collection) => collection.slug === slug)
    const users = withUsersAuth(
      existingIndex === -1 ? undefined : config.collections[existingIndex],
      { access, adminRole, defaultRole, roles, slug },
    )

    if (existingIndex === -1) {
      config.collections.push(users)
    } else {
      config.collections[existingIndex] = users
    }

    /**
     * If the plugin is disabled, we still want to keep added collections/fields so the database schema is consistent which is important for migrations.
     */
    if (pluginOptions.disabled) {
      return config
    }

    return config
  }

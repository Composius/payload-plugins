import type { Access, FieldAccess } from 'payload'

const roleOf = (user: unknown): string | undefined => {
  const role = (user as { role?: unknown } | null | undefined)?.role
  return typeof role === 'string' ? role : undefined
}

let configuredAdminRole = 'admin'

/**
 * Set by the plugin factory to the configured `adminRole` option, so that
 * `isAdmin`/`isAdminOrHasRole` follow it. Not meant to be called directly.
 */
export const setAdminRole = (role: string): void => {
  configuredAdminRole = role
}

/** Collection access allowing only users whose `role` is one of the given values. */
export const hasRole =
  (...roles: string[]): Access =>
  ({ req: { user } }) => {
    const role = roleOf(user)
    return role !== undefined && roles.includes(role)
  }

/** Field-level variant of {@link hasRole} (field access cannot return a query). */
export const hasRoleFieldLevel =
  (...roles: string[]): FieldAccess =>
  ({ req: { user } }) => {
    const role = roleOf(user)
    return role !== undefined && roles.includes(role)
  }

/** Collection access allowing any authenticated user. */
export const isAuthenticated: Access = ({ req: { user } }) => Boolean(user)

/** Collection access allowing only users with the plugin's `adminRole` (default `'admin'`). */
export const isAdmin: Access = ({ req: { user } }) => roleOf(user) === configuredAdminRole

/** Collection access allowing the plugin's `adminRole` or any of the given roles. */
export const isAdminOrHasRole =
  (...roles: string[]): Access =>
  ({ req: { user } }) => {
    const role = roleOf(user)
    return role !== undefined && (role === configuredAdminRole || roles.includes(role))
  }

/**
 * Collection access allowing authenticated users to see everything, and the
 * public only published documents. For collections with drafts enabled
 * (`versions.drafts`), where Payload maintains the `_status` field.
 */
export const isAuthenticatedOrPublished: Access = ({ req: { user } }) => {
  if (user) {
    return true
  }

  return { _status: { equals: 'published' } }
}

/**
 * Collection access allowing users whose `role` is one of the given values, and
 * otherwise restricting the operation to documents the user owns: those whose
 * `ownerField` equals the user's id. Use `'id'` (the default) for the users
 * collection itself, or a relationship field name (e.g. `'owner'`, `'author'`)
 * for other collections.
 */
export const hasRoleOrOwner =
  (roles: string[], ownerField = 'id'): Access =>
  ({ req: { user } }) => {
    if (!user) {
      return false
    }

    const role = roleOf(user)
    if (role !== undefined && roles.includes(role)) {
      return true
    }

    return { [ownerField]: { equals: user.id } }
  }

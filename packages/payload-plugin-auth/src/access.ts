import type { Access, FieldAccess } from 'payload'

const roleOf = (user: unknown): string | undefined => {
  const role = (user as { role?: unknown } | null | undefined)?.role
  return typeof role === 'string' ? role : undefined
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

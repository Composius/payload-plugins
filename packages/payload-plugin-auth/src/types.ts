import type { Access } from 'payload'

export type Role = {
  label: Record<string, string> | string
  value: string
}

export type UsersAccess = {
  create?: Access
  delete?: Access
  read?: Access
  update?: Access
}

export type UsersOptions = {
  access: Required<UsersAccess>
  adminRole: string
  defaultRole: string
  roles: Role[]
  slug: string
}

export type VWPayloadPluginAuthConfig = {
  /**
   * Access control for the users collection, per operation.
   * Defaults: `create`/`delete` require the admin role, `read`/`update` allow
   * the admin role or the user themselves.
   */
  access?: UsersAccess
  /**
   * Role value granting full access to the users collection and admin UI.
   * Must be one of `roles`. Defaults to `'admin'`.
   */
  adminRole?: string
  /**
   * Role value assigned to new users by default. Must be one of `roles`.
   * Defaults to `'viewer'`.
   */
  defaultRole?: string
  disabled?: boolean
  /**
   * Selectable roles for the `role` field.
   * Defaults to Admin (`admin`), Editor (`editor`) and Viewer (`viewer`).
   */
  roles?: Role[]
  /**
   * Slug of the auth users collection to extend (created when it does not
   * exist yet). Defaults to `'users'`.
   */
  slug?: string
}

import type { Access, CollectionConfig, Config, SelectField } from 'payload'

import { describe, expect, test } from 'vitest'

import {
  ComposiusPayloadPluginAuth,
  hasRole,
  hasRoleFieldLevel,
  hasRoleOrOwner,
  isAdmin,
  isAdminOrHasRole,
  isAuthenticatedOrPublished,
} from '../src/index.js'

const accessArgs = (user: unknown) => ({ req: { user } }) as Parameters<Access>[0]

const baseConfig = (): Config => ({ collections: [] }) as unknown as Config

const findUsers = (config: Config, slug = 'users'): CollectionConfig => {
  const users = config.collections?.find((collection) => collection.slug === slug)
  expect(users).toBeDefined()
  return users!
}

const findRole = (users: CollectionConfig): SelectField => {
  const role = users.fields.find((field) => (field as { name?: string }).name === 'role')
  expect(role).toBeDefined()
  return role as SelectField
}

describe('access helpers', () => {
  test('hasRole allows only listed roles', () => {
    const editorOrAdmin = hasRole('admin', 'editor')
    expect(editorOrAdmin(accessArgs({ id: 1, role: 'admin' }))).toBe(true)
    expect(editorOrAdmin(accessArgs({ id: 1, role: 'editor' }))).toBe(true)
    expect(editorOrAdmin(accessArgs({ id: 1, role: 'viewer' }))).toBe(false)
    expect(editorOrAdmin(accessArgs({ id: 1 }))).toBe(false)
    expect(editorOrAdmin(accessArgs(null))).toBe(false)
  })

  test('hasRoleFieldLevel mirrors hasRole', () => {
    const admin = hasRoleFieldLevel('admin')
    expect(admin(accessArgs({ id: 1, role: 'admin' }))).toBe(true)
    expect(admin(accessArgs({ id: 1, role: 'viewer' }))).toBe(false)
    expect(admin(accessArgs(null))).toBe(false)
  })

  test('hasRoleOrOwner allows listed roles and otherwise scopes to owned docs', () => {
    const adminOrOwner = hasRoleOrOwner(['admin'], 'owner')
    expect(adminOrOwner(accessArgs({ id: 1, role: 'admin' }))).toBe(true)
    expect(adminOrOwner(accessArgs({ id: 7, role: 'viewer' }))).toEqual({
      owner: { equals: 7 },
    })
    expect(adminOrOwner(accessArgs(null))).toBe(false)
  })

  test('hasRoleOrOwner defaults the owner field to id (self access)', () => {
    const adminOrSelf = hasRoleOrOwner(['admin'])
    expect(adminOrSelf(accessArgs({ id: 7, role: 'viewer' }))).toEqual({
      id: { equals: 7 },
    })
  })

  test('isAdmin allows only the admin role', () => {
    expect(isAdmin(accessArgs({ id: 1, role: 'admin' }))).toBe(true)
    expect(isAdmin(accessArgs({ id: 1, role: 'editor' }))).toBe(false)
    expect(isAdmin(accessArgs(null))).toBe(false)
  })

  test('isAdminOrHasRole allows the admin role plus the given roles', () => {
    const adminOrEditor = isAdminOrHasRole('editor')
    expect(adminOrEditor(accessArgs({ id: 1, role: 'admin' }))).toBe(true)
    expect(adminOrEditor(accessArgs({ id: 1, role: 'editor' }))).toBe(true)
    expect(adminOrEditor(accessArgs({ id: 1, role: 'viewer' }))).toBe(false)
    expect(adminOrEditor(accessArgs(null))).toBe(false)
  })

  test('isAdmin and isAdminOrHasRole follow a custom adminRole option', () => {
    ComposiusPayloadPluginAuth({
      adminRole: 'owner',
      defaultRole: 'member',
      roles: [
        { label: 'Owner', value: 'owner' },
        { label: 'Member', value: 'member' },
      ],
    })(baseConfig())

    expect(isAdmin(accessArgs({ id: 1, role: 'owner' }))).toBe(true)
    expect(isAdmin(accessArgs({ id: 1, role: 'admin' }))).toBe(false)
    expect(isAdminOrHasRole('member')(accessArgs({ id: 1, role: 'owner' }))).toBe(true)

    // restore the default adminRole for the remaining tests
    ComposiusPayloadPluginAuth()(baseConfig())
    expect(isAdmin(accessArgs({ id: 1, role: 'admin' }))).toBe(true)
  })

  test('isAuthenticatedOrPublished allows users, and the public only published docs', () => {
    expect(isAuthenticatedOrPublished(accessArgs({ id: 1, role: 'viewer' }))).toBe(true)
    expect(isAuthenticatedOrPublished(accessArgs(null))).toEqual({
      _status: { equals: 'published' },
    })
  })
})

describe('ComposiusPayloadPluginAuth', () => {
  test('adds the users collection with auth and admin settings', () => {
    const config = ComposiusPayloadPluginAuth()(baseConfig())
    const users = findUsers(config)

    const fieldNames = users.fields.map((field) => (field as { name?: string }).name)
    expect(fieldNames).toContain('name')
    expect(fieldNames).toContain('role')
    expect(users.admin?.useAsTitle).toBe('name')
    expect(users.admin?.defaultColumns).toEqual(['name', 'email', 'role', 'createdAt'])
    expect(users.auth).toMatchObject({
      lockTime: 15 * 60 * 1000,
      maxLoginAttempts: 5,
    })
  })

  test('collection is hidden in the admin UI for non-admins', () => {
    const config = ComposiusPayloadPluginAuth()(baseConfig())
    const hidden = findUsers(config).admin?.hidden as (args: { user: unknown }) => boolean

    expect(hidden({ user: { role: 'admin' } })).toBe(false)
    expect(hidden({ user: { role: 'viewer' } })).toBe(true)
    expect(hidden({ user: null })).toBe(true)
  })

  test('role field defaults, saves to JWT, and is admin-only to change', () => {
    const config = ComposiusPayloadPluginAuth()(baseConfig())
    const role = findRole(findUsers(config))

    expect(role.defaultValue).toBe('viewer')
    expect(role.required).toBe(true)
    expect(role.saveToJWT).toBe(true)
    expect(role.options).toHaveLength(3)
    expect(role.access?.create?.(accessArgs({ id: 1, role: 'viewer' }))).toBe(false)
    expect(role.access?.update?.(accessArgs({ id: 1, role: 'admin' }))).toBe(true)
  })

  test('default access: admins manage, users read/update themselves', () => {
    const config = ComposiusPayloadPluginAuth()(baseConfig())
    const users = findUsers(config)

    expect(users.access?.create?.(accessArgs({ id: 1, role: 'viewer' }))).toBe(false)
    expect(users.access?.delete?.(accessArgs({ id: 1, role: 'admin' }))).toBe(true)
    expect(users.access?.read?.(accessArgs({ id: 5, role: 'editor' }))).toEqual({
      id: { equals: 5 },
    })
    expect(users.access?.update?.(accessArgs({ id: 1, role: 'admin' }))).toBe(true)
  })

  test('custom access overrides replace only the provided operations', () => {
    const read: Access = () => true
    const config = ComposiusPayloadPluginAuth({ access: { read } })(baseConfig())
    const users = findUsers(config)

    expect(users.access?.read).toBe(read)
    expect(users.access?.create?.(accessArgs({ id: 1, role: 'viewer' }))).toBe(false)
  })

  test('custom roles, adminRole and defaultRole are applied', () => {
    const config = ComposiusPayloadPluginAuth({
      adminRole: 'owner',
      defaultRole: 'member',
      roles: [
        { label: 'Owner', value: 'owner' },
        { label: 'Member', value: 'member' },
      ],
    })(baseConfig())
    const users = findUsers(config)
    const role = findRole(users)

    expect(role.defaultValue).toBe('member')
    expect((role.options as { value: string }[]).map((option) => option.value)).toEqual([
      'owner',
      'member',
    ])
    expect(users.access?.create?.(accessArgs({ id: 1, role: 'owner' }))).toBe(true)
    expect(users.access?.create?.(accessArgs({ id: 1, role: 'member' }))).toBe(false)
  })

  test('throws when adminRole or defaultRole is not a configured role', () => {
    expect(() => ComposiusPayloadPluginAuth({ adminRole: 'boss' })(baseConfig())).toThrow(
      /adminRole "boss"/,
    )
    expect(() => ComposiusPayloadPluginAuth({ defaultRole: 'guest' })(baseConfig())).toThrow(
      /defaultRole "guest"/,
    )
  })

  test('extends an existing users collection instead of replacing it', () => {
    const existing: CollectionConfig = {
      slug: 'users',
      admin: { useAsTitle: 'email' },
      fields: [{ name: 'bio', type: 'textarea' }],
    }
    const config = ComposiusPayloadPluginAuth()({ collections: [existing] } as unknown as Config)

    expect(config.collections).toHaveLength(1)
    const users = findUsers(config)
    const fieldNames = users.fields.map((field) => (field as { name?: string }).name)
    expect(fieldNames).toEqual(['bio', 'name', 'role'])
    // explicit existing settings win over the plugin's
    expect(users.admin?.useAsTitle).toBe('email')
    expect(users.admin?.defaultColumns).toEqual(['name', 'email', 'role', 'createdAt'])
  })

  test('does not duplicate fields already defined on the existing collection', () => {
    const existing: CollectionConfig = {
      slug: 'users',
      fields: [{ name: 'name', type: 'text' }],
    }
    const config = ComposiusPayloadPluginAuth()({ collections: [existing] } as unknown as Config)

    const names = findUsers(config).fields.filter(
      (field) => (field as { name?: string }).name === 'name',
    )
    expect(names).toHaveLength(1)
  })

  test('supports a custom collection slug', () => {
    const config = ComposiusPayloadPluginAuth({ slug: 'members' })(baseConfig())
    findUsers(config, 'members')
  })

  test('disabled still registers the collection for schema consistency', () => {
    const config = ComposiusPayloadPluginAuth({ disabled: true })(baseConfig())
    findUsers(config)
  })
})

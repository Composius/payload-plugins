import type { CollectionConfig, CollectionSlug, Field, PayloadRequest } from 'payload'

import { APIError } from 'payload'

import type { UsersOptions } from '../types.js'

import { hasRoleFieldLevel } from '../access.js'
import { label, translate } from '../translations/index.js'

const fieldNames = (fields: Field[]): string[] =>
  fields.map((field) => (field as { name?: string }).name).filter((name): name is string =>
    Boolean(name),
  )

/**
 * Extends an existing users collection with auth settings, role field, access
 * control and last-admin protections. Explicit settings already present on the
 * existing collection win over the plugin's; when there is no existing
 * collection, pass `undefined` to build one from scratch.
 */
export const withUsersAuth = (
  existing: CollectionConfig | undefined,
  { slug, access, adminRole, defaultRole, roles }: UsersOptions,
): CollectionConfig => {
  const collection = slug as CollectionSlug
  const adminFieldLevel = hasRoleFieldLevel(adminRole)

  const countAdmins = (req: PayloadRequest) =>
    req.payload.count({
      collection,
      req,
      where: { role: { equals: adminRole } },
    })

  const existingAuth = typeof existing?.auth === 'object' ? existing.auth : {}
  const existingFieldNames = fieldNames(existing?.fields ?? [])

  const addedFields: Field[] = [
    // Email added by default
    {
      name: 'name',
      type: 'text',
      label: label((t) => t.fields.name),
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      access: {
        // Users can update their own profile, but only admins can change roles
        create: adminFieldLevel,
        update: adminFieldLevel,
      },
      defaultValue: defaultRole,
      hooks: {
        // A duplicate copies field values straight off the source document,
        // which would carry an admin's role onto the copy without ever going
        // through the `create` access above (GHSA-vc4h-q48j-5hcx). Payload
        // enforces field access on duplicate as of 3.90.0; resetting the value
        // here keeps the guarantee from depending on that.
        beforeDuplicate: [() => defaultRole],
      },
      label: label((t) => t.fields.role),
      options: roles,
      required: true,
      saveToJWT: true,
    },
  ]

  return {
    ...existing,
    slug,
    access: {
      create: access.create,
      delete: access.delete,
      read: access.read,
      update: access.update,
      ...existing?.access,
    },
    admin: {
      defaultColumns: ['name', 'email', 'role', 'createdAt'],
      hidden: ({ user }) => (user as { role?: string } | null)?.role !== adminRole,
      useAsTitle: 'name',
      ...existing?.admin,
    },
    auth: {
      ...existingAuth,
      cookies: {
        // secure: true would break plain-http localhost logins in dev
        sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production',
        ...existingAuth.cookies,
      },
      lockTime: existingAuth.lockTime ?? 15 * 60 * 1000, // 15 minutes
      maxLoginAttempts: existingAuth.maxLoginAttempts ?? 5,
    },
    fields: [
      ...(existing?.fields ?? []),
      ...addedFields.filter(
        (field) => !existingFieldNames.includes((field as { name?: string }).name ?? ''),
      ),
    ],
    hooks: {
      ...existing?.hooks,
      beforeChange: [
        ...(existing?.hooks?.beforeChange ?? []),
        async ({ data, operation, originalDoc, req }) => {
          if (operation === 'create') {
            // The very first user must get the admin role no matter what was
            // submitted: role creation is admin-only, so a non-admin first
            // user would leave the panel without anyone able to manage users.
            const { totalDocs } = await req.payload.count({ collection, req })
            if (totalDocs === 0) {
              data.role = adminRole
            }
            return data
          }

          if (
            operation === 'update' &&
            originalDoc?.role === adminRole &&
            typeof data?.role === 'string' &&
            data.role !== adminRole
          ) {
            const { totalDocs } = await countAdmins(req)
            if (totalDocs <= 1) {
              throw new APIError(
                translate(req.i18n?.language, (t) => t.errors.lastAdminRole),
                403,
              )
            }
          }

          return data
        },
      ],
      beforeDelete: [
        ...(existing?.hooks?.beforeDelete ?? []),
        async ({ id, req }) => {
          const doc = await req.payload.findByID({ id, collection, depth: 0, req })
          if ((doc as { role?: string } | null)?.role === adminRole) {
            const { totalDocs } = await countAdmins(req)
            if (totalDocs <= 1) {
              throw new APIError(
                translate(req.i18n?.language, (t) => t.errors.lastAdminDelete),
                403,
              )
            }
          }
        },
      ],
    },
    labels: existing?.labels ?? {
      plural: label((t) => t.users.plural),
      singular: label((t) => t.users.singular),
    },
  }
}

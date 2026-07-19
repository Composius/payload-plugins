# @composius/payload-plugin-auth

A [Payload CMS](https://payloadcms.com) plugin that turns a `users` collection into a
role-based auth collection — configurable roles, sensible auth hardening, and exported
access helpers (`hasRole`, `hasRoleOrOwner`) for use in your other collections.

If the collection already exists in your config it is extended (your explicit settings
win); otherwise it is created.

## Fields

| Field  | Type     | Notes                                                            |
| ------ | -------- | ---------------------------------------------------------------- |
| `name` | `text`   | required, used as admin title                                    |
| `role` | `select` | required, saved to the JWT; only admins can set or change it     |

Email and password are added by Payload's auth. The collection also sets:

- Cookies: `secure` in production only (plain-http localhost logins keep working in dev), `sameSite: 'Lax'`.
- Brute-force protection: 5 max login attempts, 15 minutes lock time.
- Admin UI: the collection is hidden from users without the admin role.
- Access: `create`/`delete` admin only, `read`/`update` admin or the user themselves.

## Admin lockout protection

- The **first user created is always given the admin role**, whatever was submitted —
  otherwise the default role would apply (role changes are admin-only) and nobody could
  ever manage users.
- The **last admin cannot be deleted or demoted**; such operations fail with a 403.
- `adminRole`/`defaultRole` values that are not in `roles` throw at config build time.

## Requirements

The following dependencies are required to be installed in your project before using this plugin:

- `payload` (`^3.84.1`)

```bash
pnpm add payload
```

## Usage

```ts
import { buildConfig } from 'payload'
import { ComposiusPayloadPluginAuth, hasRole, hasRoleOrOwner } from '@composius/payload-plugin-auth'

export default buildConfig({
  plugins: [
    ComposiusPayloadPluginAuth({
      // Custom roles: the role select offers these instead of the defaults
      roles: [
        { label: 'Admin', value: 'admin' },
        { label: 'Author', value: 'author' },
        { label: 'Member', value: 'member' },
      ],
      // New users become members; the very first user still becomes admin
      defaultRole: 'member',
    }),
  ],
  collections: [
    {
      slug: 'articles',
      access: {
        read: () => true,
        create: hasRole('admin', 'author'),
        // admins see everything, authors only the articles they authored
        update: hasRoleOrOwner(['admin'], 'author'),
        delete: hasRole('admin'),
      },
      fields: [{ name: 'author', type: 'relationship', relationTo: 'users' }],
    },
  ],
  // ...
})
```

### Access helpers

- `hasRole(...roles)` — collection access allowing users whose `role` is one of the given values.
- `hasRoleFieldLevel(...roles)` — the same check as field-level access (field access cannot return a query).
- `hasRoleOrOwner(roles, ownerField = 'id')` — allows the given roles, and otherwise
  restricts the operation to documents whose `ownerField` equals the user's id. The
  default `'id'` gives "self" access on the users collection; pass a relationship field
  name (`'author'`, `'owner'`, …) for other collections.
- `isAdmin` — allows only the plugin's `adminRole` (follows the option, default `'admin'`).
- `isAdminOrHasRole(...roles)` — allows the plugin's `adminRole` or any of the given roles.
- `isAuthenticatedOrPublished` — allows any authenticated user, and restricts the
  public to published documents (`_status: 'published'`); for collections with
  drafts enabled.

## Options

All optional — defaults shown as comments:

```ts
ComposiusPayloadPluginAuth({
  // Access per operation. Defaults: create/delete = admin role,
  // read/update = admin role or the user themselves.
  access: { read, create, update, delete },

  // Role value with full access to the users collection and admin UI.
  adminRole: 'admin',

  // Role value assigned to new users (except the very first, who becomes admin).
  defaultRole: 'viewer',

  // Selectable roles. Default: Admin, Editor, Viewer.
  roles: [
    { label: 'Admin', value: 'admin' },
    { label: 'Editor', value: 'editor' },
    { label: 'Viewer', value: 'viewer' },
  ],

  // Slug of the auth collection to extend or create.
  slug: 'users',

  // Keeps the collection schema but disables runtime behavior (default: false).
  disabled: false,
})
```

## Development

From the monorepo root:

```bash
pnpm install
pnpm dev:auth                                        # dev Payload app with this plugin
pnpm vitest run packages/payload-plugin-auth/test    # unit tests
pnpm vitest run dev/configs/auth                     # integration tests
pnpm --filter @composius/payload-plugin-auth build  # build to dist/
```

See the [root README](../../README.md) for the release flow.

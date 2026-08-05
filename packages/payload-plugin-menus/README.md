# @composius/payload-plugin-menus

A [Payload CMS](https://payloadcms.com) plugin that adds a `menus` collection.

## Fields

| Field        | Type     | Notes                                                    |
| ------------ | -------- | -------------------------------------------------------- |
| `name`       | `text`   | required, used as admin title                            |
| `links`      | `blocks` | menu items, see below                                    |
| `linksCount` | `number` | virtual, computed at read time; shown as list-view column |

### Links

Each item in `links` is one of two block types:

- **`external`** — a `title` and a `url`, both required.
- **`internal`** — a `doc` relationship to one of the collections configured via the
  `collections` option (pick the collection, then the document), plus an optional
  `title` and an optional `anchor`. Only available when `collections` is non-empty.

Both block types also have a `newTab` checkbox (default `false`) for opening the
link in a new tab.

An internal link's `anchor` targets a section of the linked document. It is stored
without its leading `#` — typing `#contact` or `contact` both save as `contact` —
so a front end can build the href as `` `${path}#${anchor}` `` unconditionally.

For internal links, the title resolves at read time: when `title` is empty, an
`afterRead` hook fills it with the linked document's title (its `admin.useAsTitle`
field), so renaming the document updates menus automatically. Editors can type a
custom title to override it. A `beforeChange` hook discards a submitted title that
merely matches the linked document's current title, so saving the untouched
auto-filled value in the admin panel does not freeze it into an override.

## Cache revalidation

Saving or deleting a menu invalidates the collection's Next.js cache tags, so a
front end built on `cacheComponents` picks the change up. Tag a `'use cache'`
function with the matching tag and the admin panel does the rest:

```ts
// app/layout.tsx
import { cacheTag } from 'next/cache'
import { MENUS_TAG } from '@composius/payload-plugin-menus/tags'
import { getPayload } from 'payload'
import config from '@payload-config'

const getMenus = async () => {
  'use cache'
  cacheTag(MENUS_TAG)

  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection: 'menus', depth: 2 })
  return docs
}
```

The tags, all exported from `@composius/payload-plugin-menus/tags` — an entry
point that imports neither `payload` nor `next`:

| Tag              | Covers                                                    |
| ---------------- | --------------------------------------------------------- |
| `MENUS_TAG`      | every menu — the tag a layout rendering the nav should use |
| `menuTag(name)`  | the menus with that `name`                                 |
| `menuIdTag(id)`  | one menu, by id                                            |

A save invalidates the collection tag and both tags of the document, plus the
former `name` when a menu is renamed.

Internal link titles resolve at read time from the linked document, so renaming
that document changes the menu's rendered output without touching the menu
itself. Nothing here can see that — invalidate `MENUS_TAG` from the linked
collection's own hooks if your nav shows those titles.

By default the tags expire at once, so the first visitor after a save is served
a fresh page. Pass `revalidate: { profile: 'max' }` for stale-while-revalidate
instead: nobody waits, but the visitor right after a save — usually the editor
checking their own work — sees the previous version.

Revalidation is a no-op wherever Next.js is not running (a migration, a seeding
script, a test run), and never fails a write. To skip it for one operation, set
`context.disableRevalidate`:

```ts
await payload.update({
  collection: 'menus',
  id,
  data,
  context: { disableRevalidate: true },
})
```

## Requirements

The following dependencies are required to be installed in your project before using this plugin:

- `payload` (`^3.84.1`)

```bash
pnpm add payload
```

`next` (`^16.0.0`) is an optional peer dependency: it is only needed for cache
revalidation, and any Payload app already running inside Next.js has it.

## Usage

```ts
import { buildConfig } from 'payload'
import { ComposiusPayloadPluginMenus } from '@composius/payload-plugin-menus'

export default buildConfig({
  plugins: [ComposiusPayloadPluginMenus({ collections: ['pages'] })],
  // ...
})
```

## Options

All optional — defaults shown as comments:

```ts
ComposiusPayloadPluginMenus({
  // Access per operation. Defaults: read = anyone,
  // create/update/delete = authenticated.
  access: { read, create, update, delete },

  // Collections that internal links can target (default: []).
  // When empty, only external links are available.
  collections: ['pages'],

  // Keeps the collection schema but disables runtime behavior (default: false).
  disabled: false,

  // Hides the collection from the admin nav and routes (default: false).
  // Accepts a boolean or ({ user }) => boolean to hide it per user. The
  // collection stays registered, so the schema and the API are unchanged.
  hidden: false,

  // Next.js cache invalidation on save and delete (default: enabled).
  // Pass false to drop the hooks entirely.
  revalidate: {
    // revalidateTag's second argument: a cacheLife profile name, or an
    // inline { expire } in seconds (default: { expire: 0 }).
    profile: { expire: 0 },

    // Extra tags to invalidate alongside the built-in ones.
    tags: ({ collection, doc, operation, previousDoc }) => ['sitemap'],

    // Called instead of the default debug log when a revalidation fails.
    onError: (error, event) => {},
  },
})
```

## Development

From the monorepo root:

```bash
pnpm install
pnpm dev:menus                                        # dev Payload app with this plugin
pnpm vitest run packages/payload-plugin-menus/test    # unit tests
pnpm vitest run dev/configs/menus                     # integration tests
pnpm --filter @composius/payload-plugin-menus build  # build to dist/
```

See the [root README](../../README.md) for the release flow.

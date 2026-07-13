# @vitrailweb/payload-plugin-menus

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
  `title`. Only available when `collections` is non-empty.

Both block types also have a `newTab` checkbox (default `false`) for opening the
link in a new tab.

For internal links, the title resolves at read time: when `title` is empty, an
`afterRead` hook fills it with the linked document's title (its `admin.useAsTitle`
field), so renaming the document updates menus automatically. Editors can type a
custom title to override it. A `beforeChange` hook discards a submitted title that
merely matches the linked document's current title, so saving the untouched
auto-filled value in the admin panel does not freeze it into an override.

## Usage

```ts
import { buildConfig } from 'payload'
import { VWPayloadPluginMenus } from '@vitrailweb/payload-plugin-menus'

export default buildConfig({
  plugins: [VWPayloadPluginMenus({ collections: ['pages'] })],
  // ...
})
```

## Options

All optional — defaults shown as comments:

```ts
VWPayloadPluginMenus({
  // Access per operation. Defaults: read = anyone,
  // create/update/delete = authenticated.
  access: { read, create, update, delete },

  // Collections that internal links can target (default: []).
  // When empty, only external links are available.
  collections: ['pages'],

  // Keeps the collection schema but disables runtime behavior (default: false).
  disabled: false,
})
```

## Development

From the monorepo root:

```bash
pnpm install
pnpm dev:menus                                        # dev Payload app with this plugin
pnpm vitest run packages/payload-plugin-menus/test    # unit tests
pnpm vitest run dev/configs/menus                     # integration tests
pnpm --filter @vitrailweb/payload-plugin-menus build  # build to dist/
```

See the [root README](../../README.md) for the release flow.
